import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import { handleRecordResponse } from "@/lib/handlers";
import { createDraft } from "@/lib/intake";
import { normalizePhone } from "@/lib/core/normalize";
import { parseQuickReply } from "@/lib/quickReply";
import { downloadMetaMedia, downloadTwilioMedia, transcribe } from "@/lib/stt";
import { spokenName } from "@/lib/summary";
import { replyWhatsApp } from "@/lib/whatsapp";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("whatsapp");

// Inbound WhatsApp: hospital desks answering a bed request (C6) and doctors sending a referral by text or voice note (C2).

export interface InboundMessage {
  from: string; // E.164
  text: string | null;
  audio: { provider: "twilio"; url: string } | { provider: "meta"; id: string } | null;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body). */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!appSecret || !header) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(header, expected);
}

/** Twilio: X-Twilio-Signature = base64(HMAC-SHA1(auth token, url + each param name+value, sorted by name)). */
export function verifyTwilioSignature(url: string, params: Record<string, string>, header: string | null, authToken: string): boolean {
  if (!authToken || !header) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return safeEqual(header, expected);
}

export function parseMetaPayload(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = (body as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }> })?.entry ?? [];
  for (const e of entries) {
    for (const c of e.changes ?? []) {
      for (const m of c.value?.messages ?? []) {
        const from = normalizePhone(`+${String(m.from ?? "")}`);
        if (!from) continue;
        const text = (m.text as { body?: string } | undefined)?.body ?? null;
        const audioId = (m.audio as { id?: string } | undefined)?.id ?? (m.voice as { id?: string } | undefined)?.id;
        out.push({ from, text, audio: audioId ? { provider: "meta", id: audioId } : null });
      }
    }
  }
  return out;
}

export function parseTwilioPayload(params: Record<string, string>): InboundMessage[] {
  const from = normalizePhone((params.From ?? "").replace(/^whatsapp:/, ""));
  if (!from) return [];
  const isAudio = Number(params.NumMedia ?? 0) > 0 && (params.MediaContentType0 ?? "").startsWith("audio/");
  return [{ from, text: params.Body?.trim() || null, audio: isAudio ? { provider: "twilio", url: params.MediaUrl0 } : null }];
}

const OPEN_STATUSES = ["searching", "options_ready", "confirming", "confirmed", "exhausted"];

/** C6. Returns true when the message was a hospital's reply (handled or answered with a clarification). */
async function handleHospitalReply(m: InboundMessage): Promise<boolean> {
  if (!m.text) return false;
  const reply = parseQuickReply(m.text);
  const facilityIds = (
    await q<{ id: string }>(
      `select id from facilities where whatsapp_number = $1
       union select facility_id as id from facility_contacts where phone_e164 = $1 and active`,
      [m.from],
    )
  ).map((r) => r.id);
  if (facilityIds.length === 0) return false;
  if (!reply) {
    await replyWhatsApp(m.from, "Haazir: please reply YES or NO with the reference, for example YES R-4821.");
    return true;
  }
  // Open availability requests to this hospital in the last 3 hours, latest attempt per referral.
  const open = await q<{ attempt_id: string; referral_id: string; code: string; facility_name: string }>(
    `select distinct on (a.referral_id) a.id as attempt_id, a.referral_id, r.code, f.name as facility_name
     from call_attempts a join referrals r on r.id = a.referral_id join facilities f on f.id = a.facility_id
     where a.purpose = 'availability' and a.facility_id = any($1::uuid[]) and a.created_at > $2
       and r.status = any($3::text[]) and ($4::text is null or r.code = $4)
     order by a.referral_id, a.created_at desc`,
    [facilityIds, addMinutes(now(), -180), OPEN_STATUSES, reply.code],
  );
  if (open.length === 0) {
    await replyWhatsApp(m.from, `Haazir: we couldn't find an open request${reply.code ? ` ${reply.code}` : ""} for your hospital. Thank you.`);
    return true;
  }
  if (open.length > 1) {
    // Never guess which patient a bare "yes" is about.
    await replyWhatsApp(m.from, `Haazir: there are ${open.length} open requests. Please reply with the reference: ${open.map((o) => o.code).join(", ")}.`);
    return true;
  }
  const target = open[0];
  const res = await handleRecordResponse(
    {
      attempt_id: target.attempt_id,
      outcome: reply.answer === "no" ? "declined" : reply.condition ? "conditional" : "accepted",
      conditions: reply.answer === "yes" ? reply.condition : null,
      decline_reason: reply.answer === "no" ? `other: ${reply.condition ?? "replied NO on WhatsApp"}` : null,
      contact_person: "WhatsApp reply",
    },
    "whatsapp",
  );
  await res.followUp();
  await replyWhatsApp(
    m.from,
    reply.answer === "yes"
      ? `Haazir: noted, ${spokenName(target.facility_name)} can accept ${target.code}. The doctor will confirm shortly if they send the patient.`
      : `Haazir: noted, thank you for letting us know about ${target.code}.`,
  );
  return true;
}

/** C2. A message from a registered referring doctor becomes a referral draft for them to review. */
async function handleDoctorIntake(m: InboundMessage): Promise<boolean> {
  const doc = await one<{ id: string; org_id: string }>(`select id, org_id from referrers where phone_e164 = $1 order by created_at limit 1`, [m.from]);
  if (!doc) return false;
  let text = m.text;
  let kind: "text" | "voice" = "text";
  if (m.audio) {
    kind = "voice";
    try {
      const audio = m.audio.provider === "twilio" ? await downloadTwilioMedia(m.audio.url) : await downloadMetaMedia(m.audio.id);
      text = await transcribe(audio);
    } catch (err) {
      log.error({ err }, "Voice note failed");
      text = null;
    }
    if (!text) {
      await replyWhatsApp(m.from, "Haazir: couldn't transcribe that voice note. Please type the case, or start it in the console.");
      return true;
    }
  }
  if (!text) return true;
  const draft = await createDraft({ orgId: doc.org_id, referrerId: doc.id, kind, transcript: text });
  const p = draft.parsed;
  const understood = p.matched.length ? `Understood: ${p.matched.join(", ")}.` : "Couldn't recognise the case type.";
  const link = env.appBaseUrl ? ` Review and start: ${env.appBaseUrl.replace(/\/$/, "")}/?draft=${draft.id}` : " Open Haazir to review and start it.";
  await replyWhatsApp(m.from, `Haazir: draft referral saved. ${understood}${link}`);
  return true;
}

export async function handleInbound(m: InboundMessage): Promise<"hospital_reply" | "intake" | "ignored"> {
  if (await handleHospitalReply(m)) return "hospital_reply";
  if (await handleDoctorIntake(m)) return "intake";
  return "ignored";
}
