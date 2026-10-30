import "server-only";
import { env } from "./config";
import { now } from "./clock";
import { q } from "./db";
import { addEvent } from "./events";
import { isE164, maskPhone } from "./normalize";
import type { Rendered } from "./messages";

// Provider adapter: none (stored as simulated, shown in the UI) | meta | twilio.
// Always writes a `messages` row (server-only) and a redacted `handoff_sent` event.

type Audience = "receiving_facility" | "referrer" | "family";

interface SendResult {
  status: "sent" | "simulated" | "failed";
  provider: string;
  provider_message_id: string | null;
  error: string | null;
}

async function sendMeta(to: string, body: string): Promise<SendResult> {
  const version = env.metaGraphVersion || "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${env.metaPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body } }),
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

export async function sendWhatsApp(opts: {
  referral_id: string;
  audience: Audience;
  to: string | null;
  rendered: Rendered;
  simulated: boolean;
}): Promise<void> {
  const to = opts.to && isE164(opts.to) ? opts.to : null;
  let result: SendResult;
  if (opts.simulated || env.whatsappProvider === "none" || !to) {
    result = { status: "simulated", provider: "none", provider_message_id: null, error: to ? null : "no WhatsApp number" };
  } else {
    try {
      result = env.whatsappProvider === "meta" ? await sendMeta(to, opts.rendered.body) : await sendTwilio(to, opts.rendered.body);
    } catch (err) {
      result = { status: "failed", provider: env.whatsappProvider, provider_message_id: null, error: (err as Error).message };
    }
  }
  await q(
    `insert into messages (referral_id, channel, audience, to_number, body, provider, provider_message_id, status, error, created_at)
     values ($1, 'whatsapp', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [opts.referral_id, opts.audience, to ?? "unknown", opts.rendered.body, result.provider, result.provider_message_id, result.status, result.error, now()],
  );
  await addEvent(opts.referral_id, "handoff_sent", {
    audience: opts.audience,
    to_masked: maskPhone(to),
    status: result.status,
    preview_redacted: opts.rendered.preview_redacted,
  });
}

