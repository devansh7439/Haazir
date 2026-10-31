import "server-only";
import { env } from "@/lib/core/config";

// Meta Cloud API and Twilio senders. Written without access to either account: test before relying on them (CLAUDE.md).

/** How long a send may take before it counts as failed. */
const SEND_TIMEOUT_MS = 8000;

/** A message to send: plain text, and the approved-template form of it when one exists. */
export interface OutboundMessage {
  body: string;
  template?: { key: "prearrival" | "doctor" | "family" | "bed_request"; language: string; params: string[] };
}

export interface SendResult {
  status: "sent" | "simulated" | "failed";
  provider: string;
  provider_message_id: string | null;
  error: string | null;
}

/** The value under `key` when `obj` is an object; undefined otherwise. */
const field = (obj: unknown, key: string): unknown => (obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined);
const textOf = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Meta's request body. With META_WA_TEMPLATE_<KEY> naming an approved template, the template is sent (required for
 * messages the business starts); otherwise plain text, which Meta only delivers inside a 24-hour service window.
 */
export const metaPayload = (to: string, m: OutboundMessage): Record<string, unknown> => {
  const recipient = to.replace(/^\+/, "");
  const name = m.template ? env.metaTemplate(m.template.key) : "";
  if (m.template && name) {
    return {
      messaging_product: "whatsapp",
      to: recipient,
      type: "template",
      template: {
        name,
        language: { code: m.template.language },
        components: [{ type: "body", parameters: m.template.params.map((text) => ({ type: "text", text })) }],
      },
    };
  }
  return { messaging_product: "whatsapp", to: recipient, type: "text", text: { body: m.body } };
};

const sendMeta = async (to: string, m: OutboundMessage): Promise<SendResult> => {
  const version = env.metaGraphVersion || "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${env.metaPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(metaPayload(to, m)),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = textOf(field(field(data, "error"), "message")) ?? `HTTP ${res.status}`;
    return { status: "failed", provider: "meta", provider_message_id: null, error };
  }
  const messages = field(data, "messages");
  const first = Array.isArray(messages) ? messages[0] : undefined;
  return { status: "sent", provider: "meta", provider_message_id: textOf(field(first, "id")), error: null };
};

const sendTwilio = async (to: string, body: string): Promise<SendResult> => {
  const auth = Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64");
  const form = new URLSearchParams({ From: env.twilioFrom, To: `whatsapp:${to}`, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) return { status: "failed", provider: "twilio", provider_message_id: null, error: textOf(field(data, "message")) ?? `HTTP ${res.status}` };
  return { status: "sent", provider: "twilio", provider_message_id: textOf(field(data, "sid")), error: null };
};

/** Sending through the configured provider (WHATSAPP_PROVIDER). Never throws: a failure comes back as `failed`. */
export const WhatsAppClient = {
  deliver: async (to: string, m: OutboundMessage): Promise<SendResult> => {
    try {
      return env.whatsappProvider === "meta" ? await sendMeta(to, m) : await sendTwilio(to, m.body);
    } catch (err) {
      return { status: "failed", provider: env.whatsappProvider, provider_message_id: null, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
