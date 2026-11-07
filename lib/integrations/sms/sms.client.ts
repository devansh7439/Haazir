import "server-only";
import { env } from "@/lib/core/config";

// Twilio SMS sender, the doctor's fallback when the phone has no data or the app is closed. Written without access to a
// Twilio account: test it with your own number before relying on it (CLAUDE.md, "Unverified against live services").

/** How long a send may take before it counts as failed. */
const SEND_TIMEOUT_MS = 8000;

export interface SmsResult {
  status: "sent" | "failed";
  provider: string;
  error: string | null;
}

const textOf = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Plain SMS through the configured provider (SMS_PROVIDER). Never throws: a failure comes back as `failed`. */
export const SmsClient = {
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
      const data: unknown = await res.json().catch(() => ({}));
      const message = data && typeof data === "object" ? textOf((data as Record<string, unknown>).message) : null;
      return { status: "failed", provider: "twilio", error: message ?? `HTTP ${res.status}` };
    } catch (err) {
      return { status: "failed", provider: "twilio", error: err instanceof Error ? err.message : String(err) };
    }
  },
};
