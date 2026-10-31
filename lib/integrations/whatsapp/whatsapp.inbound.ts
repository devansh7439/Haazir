import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizePhone } from "@/lib/core/normalize";

// Inbound WhatsApp from Meta and Twilio: signature checks and payload parsing. Provider-specific, no Haazir logic.

/** One inbound message: who sent it, its text, and a voice note to download if there is one. */
export interface InboundMessage {
  /** E.164. */
  from: string;
  text: string | null;
  audio: { provider: "twilio"; url: string } | { provider: "meta"; id: string } | null;
}

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const field = (obj: unknown, key: string): unknown => (obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const textOf = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body). False without a secret or a header. */
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

/** The messages in a Meta webhook body; anything unreadable is skipped. */
export function parseMetaPayload(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const e of list(field(body, "entry"))) {
    for (const c of list(field(e, "changes"))) {
      for (const m of list(field(field(c, "value"), "messages"))) {
        const from = normalizePhone(`+${String(field(m, "from") ?? "")}`);
        if (!from) continue;
        const audioId = textOf(field(field(m, "audio"), "id")) ?? textOf(field(field(m, "voice"), "id"));
        out.push({ from, text: textOf(field(field(m, "text"), "body")), audio: audioId ? { provider: "meta", id: audioId } : null });
      }
    }
  }
  return out;
}

/** The message in a Twilio webhook form; empty when the sender's number can't be read. */
export function parseTwilioPayload(params: Record<string, string>): InboundMessage[] {
  const from = normalizePhone((params.From ?? "").replace(/^whatsapp:/, ""));
  if (!from) return [];
  const isAudio = Number(params.NumMedia ?? 0) > 0 && (params.MediaContentType0 ?? "").startsWith("audio/");
  return [{ from, text: params.Body?.trim() || null, audio: isAudio ? { provider: "twilio", url: params.MediaUrl0 } : null }];
}
