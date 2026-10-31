import "server-only";
import { env } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { InboundRepository } from "@/lib/modules/intake/inbound.repository";
import { IntakeService } from "@/lib/modules/intake/intake.service";
import { parseQuickReply } from "@/lib/modules/intake/quick-reply.helper";
import { downloadMetaMedia, downloadTwilioMedia, transcribe } from "@/lib/integrations/sarvam/sarvam.stt";
import { spokenName } from "@/lib/modules/referral/summary.helper";
import { WhatsAppService } from "@/lib/modules/handoff/whatsapp.service";
import type { InboundMessage } from "@/lib/integrations/whatsapp/whatsapp.inbound";
import { createLogger } from "@/lib/core/logger";
import { FunctionService } from "@/lib/modules/call/function.service";

const log = createLogger("whatsapp");

const OPEN_STATUSES = ["searching", "options_ready", "confirming", "confirmed", "exhausted"];

/** C6. Returns true when the message was a hospital's reply (handled or answered with a clarification). */
async function handleHospitalReply(m: InboundMessage): Promise<boolean> {
  if (!m.text) return false;
  const reply = parseQuickReply(m.text);
  const facilityIds = await InboundRepository.facilityIdsForNumber(m.from);
  if (facilityIds.length === 0) return false;
  if (!reply) {
    await WhatsAppService.reply(m.from, "Haazir: please reply YES or NO with the reference, for example YES R-4821.");
    return true;
  }
  // Open availability requests to this hospital in the last 3 hours, latest attempt per referral.
  const open = await InboundRepository.openRequests(facilityIds, addMinutes(now(), -180), OPEN_STATUSES, reply.code);
  if (open.length === 0) {
    const asked = reply.code ? ` ${reply.code}` : "";
    await WhatsAppService.reply(m.from, `Haazir: we couldn't find an open request${asked} for your hospital. Thank you.`);
    return true;
  }
  if (open.length > 1) {
    // Never guess which patient a bare "yes" is about.
    const codes = open.map((o) => o.code).join(", ");
    await WhatsAppService.reply(m.from, `Haazir: there are ${open.length} open requests. Please reply with the reference: ${codes}.`);
    return true;
  }
  const target = open[0];
  const res = await FunctionService.recordResponse(
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
  await WhatsAppService.reply(
    m.from,
    reply.answer === "yes"
      ? `Haazir: noted, ${spokenName(target.facility_name)} can accept ${target.code}. ` +
        "The doctor will confirm shortly if they send the patient."
      : `Haazir: noted, thank you for letting us know about ${target.code}.`,
  );
  return true;
}

/** C2. A message from a registered referring doctor becomes a referral draft for them to review. */
async function handleDoctorIntake(m: InboundMessage): Promise<boolean> {
  const doc = await InboundRepository.referrerByPhone(m.from);
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
      await WhatsAppService.reply(m.from, "Haazir: couldn't transcribe that voice note. Please type the case, or start it in the console.");
      return true;
    }
  }
  if (!text) return true;
  const draft = await IntakeService.create({ orgId: doc.org_id, referrerId: doc.id, kind, transcript: text });
  const p = draft.parsed;
  const understood = p.matched.length ? `Understood: ${p.matched.join(", ")}.` : "Couldn't recognise the case type.";
  const base = env.appBaseUrl.replace(/\/$/, "");
  const link = env.appBaseUrl ? ` Review and start: ${base}/?draft=${draft.id}` : " Open Haazir to review and start it.";
  await WhatsAppService.reply(m.from, `Haazir: draft referral saved. ${understood}${link}`);
  return true;
}

/** Inbound WhatsApp (C2, C6): a hospital desk answering a bed request, or a doctor sending a case by text or voice note. */
export const InboundService = {
  /** Handles one message. Says which kind it was, or `ignored` when it is from neither a hospital nor a doctor. */
  handle: async (m: InboundMessage): Promise<"hospital_reply" | "intake" | "ignored"> => {
    if (await handleHospitalReply(m)) return "hospital_reply";
    if (await handleDoctorIntake(m)) return "intake";
    return "ignored";
  },
};
