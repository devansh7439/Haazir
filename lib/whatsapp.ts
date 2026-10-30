import "server-only";
import { env } from "./config";
import { now } from "./clock";
import { q } from "./db";
import { addEvent } from "./events";
import { isE164, maskPhone } from "./normalize";
import type { Rendered } from "./messages";

// Provider adapter: none (stored as simulated, shown in the UI) | meta | twilio.
// Always writes a `messages` row (server-only) and a redacted event for the console.
// Meta: if META_WA_TEMPLATE_<KEY> names an approved template, the template is sent (required for messages the
// business starts); otherwise plain text, which Meta only delivers inside a 24-hour customer-service window.

type Audience = "receiving_facility" | "referrer" | "family" | "availability_ping";

interface SendResult {
  status: "sent" | "simulated" | "failed";
  provider: string;
  provider_message_id: string | null;
  error: string | null;
}

export function metaPayload(to: string, rendered: Pick<Rendered, "body" | "template">): Record<string, unknown> {
  const recipient = to.replace(/^\+/, "");
  const name = rendered.template ? env.metaTemplate(rendered.template.key) : "";
  if (rendered.template && name) {
    return {
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name,
        language: { code: rendered.template.language },
        components: [{ type: "body", parameters: rendered.template.params.map((text) => ({ type: "text", text })) }],
      },
    };
  }
  return { messaging_product: "whatsapp", to: recipient, type: "text", text: { body: rendered.body } };
}

async function sendMeta(to: string, rendered: Pick<Rendered, "body" | "template">): Promise<SendResult> {
  const version = env.metaGraphVersion || "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${env.metaPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(metaPayload(to, rendered)),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string } };
  if (!res.ok) return { status: "failed", provider: "meta", provider_message_id: null, error: data.error?.message ?? `HTTP ${res.status}` };
  return { status: "sent", provider: "meta", provider_message_id: data.messages?.[0]?.id ?? null, error: null };
}

async function sendTwilio(to: string, body: string): Promise<SendResult> {
  const auth = Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64");
  const form = new URLSearchParams({ From: env.twilioFrom, To: `whatsapp:${to}`, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) return { status: "failed", provider: "twilio", provider_message_id: null, error: data.message ?? `HTTP ${res.status}` };
  return { status: "sent", provider: "twilio", provider_message_id: data.sid ?? null, error: null };
}

async function deliver(to: string, rendered: Pick<Rendered, "body" | "template">): Promise<SendResult> {
  try {
    return env.whatsappProvider === "meta" ? await sendMeta(to, rendered) : await sendTwilio(to, rendered.body);
  } catch (err) {
    return { status: "failed", provider: env.whatsappProvider, provider_message_id: null, error: (err as Error).message };
  }
}

export async function sendWhatsApp(opts: {
  referral_id: string;
  audience: Audience;
  to: string | null;
  rendered: Rendered;
  simulated: boolean;
  eventType?: string;
  facilityId?: string | null;
}): Promise<void> {
  const to = opts.to && isE164(opts.to) ? opts.to : null;
  const result: SendResult =
    opts.simulated || env.whatsappProvider === "none" || !to
      ? { status: "simulated", provider: "none", provider_message_id: null, error: to ? null : "no WhatsApp number" }
      : await deliver(to, opts.rendered);
  await q(
    `insert into messages (referral_id, channel, audience, to_number, body, provider, provider_message_id, status, error, created_at)
     values ($1, 'whatsapp', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [opts.referral_id, opts.audience, to ?? "unknown", opts.rendered.body, result.provider, result.provider_message_id, result.status, result.error, now()],
  );
  await addEvent(opts.referral_id, opts.eventType ?? "handoff_sent", {
    audience: opts.audience,
    facility_id: opts.facilityId ?? null,
    to_masked: maskPhone(to),
    status: result.status,
    preview_redacted: opts.rendered.preview_redacted,
  });
}

/** A direct reply in an open conversation (e.g. "Noted: R-4821 accepted"). Never carries identifiers; not stored. */
export async function replyWhatsApp(to: string, body: string): Promise<void> {
  if (env.whatsappProvider === "none" || !isE164(to)) return;
  await deliver(to, { body });
}
