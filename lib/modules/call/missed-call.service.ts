import "server-only";
import { addMinutes, now } from "@/lib/core/clock";
import { normalizePhone } from "@/lib/core/normalize";
import { CallService } from "@/lib/modules/call/call.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

/** How far back a confirmed referral still counts as the one a missed call is about. */
const LOOKBACK_MIN = 24 * 60;

export type MissedCallAction = "ignored" | "no_referral" | "family_call";

/**
 * The caller's number from a missed-call webhook body: JSON `{"from": "+91…"}` or form fields From, CallFrom or
 * from. Null when there is none.
 */
export function parseMissedCallFrom(raw: string): string | null {
  try {
    const body: unknown = JSON.parse(raw);
    const from = body && typeof body === "object" ? (body as Record<string, unknown>).from : undefined;
    return typeof from === "string" ? from : null;
  } catch {
    const p = new URLSearchParams(raw);
    return p.get("From") ?? p.get("CallFrom") ?? p.get("from");
  }
}

/** C3: a family member on a feature phone gives a missed call; we call them back with the update in their language. */
export const MissedCallService = {
  /**
   * Finds the latest confirmed referral (last 24 hours) whose attendant has this number. `followUp` places the family
   * call and is set only when one is due; the route runs it after answering.
   */
  handle: async (raw: string): Promise<{ action: MissedCallAction; followUp?: () => Promise<void> }> => {
    const phone = normalizePhone(parseMissedCallFrom(raw));
    if (!phone) return { action: "ignored" };
    const referralId = await ReferralRepository.latestConfirmedForAttendant(phone, addMinutes(now(), -LOOKBACK_MIN));
    if (!referralId) return { action: "no_referral" };
    return {
      action: "family_call",
      followUp: async () => {
        const r = await ReferralRepository.get(referralId);
        if (r) await CallService.dispatchFamilyCall(r, "missed_call");
      },
    };
  },
};
