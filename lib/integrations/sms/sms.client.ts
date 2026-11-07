import "server-only";
import { env } from "@/lib/core/config";
import { readText, redactNumbers } from "@/lib/core/normalize";

// Twilio SMS sender, the doctor's fallback when the phone has no data or the app is closed. Written without access to a
// Twilio account: test it with your own number before relying on it (CLAUDE.md, "Unverified against live services").

/** How long a send may take before it counts as failed. */
const SEND_TIMEOUT_MS = 8000;

/** `error` has any phone number in the provider's text masked, so it is safe to log (CLAUDE.md rule 1). */
export interface SmsResult {
  status: "sent" | "failed";
  provider: string;
  error: string | null;
}

/** Plain SMS through the configured provider (SMS_PROVIDER). Never throws: a failure comes back as `failed`. */
export const SmsClient = {
  /** Sends one text message; the number is in E.164. */
  deliver: async (to: string, body: string): Promise<SmsResult> => {
    try {
      const auth = Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: env.twilioSmsFrom, To: to, Body: body }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (res.ok) return { status: "sent", provider: "twilio", error: null };
      const message = readText(await res.json().catch(() => null), "message");
      return { status: "failed", provider: "twilio", error: redactNumbers(message ?? `HTTP ${res.status}`) };
    } catch (err) {
      return { status: "failed", provider: "twilio", error: redactNumbers(err instanceof Error ? err.message : String(err)) };
    }
  },
};
