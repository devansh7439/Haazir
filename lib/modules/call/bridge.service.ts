import "server-only";
import { BRIDGE_MATCH_WINDOW_MIN } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { normalizePhone } from "@/lib/core/normalize";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { WebhookLogRepository } from "@/lib/modules/call/webhook.repository";
import { CANCELLABLE } from "@/lib/modules/referral/referral.helper";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

/**
 * The bridge number: a number on the telephony provider that Bolna's Transfer Call tool points at. The provider asks us
 * who to dial; the answer is the referring doctor of the live referral whose call to the caller's number we placed in the
 * last BRIDGE_MATCH_WINDOW_MIN minutes. It never dials a number the caller supplied. Untested: it assumes the transferred
 * leg arrives with the desk's number as the caller (docs/05 §7).
 */
export const BridgeService = {
  /** The doctor's number for a transferred call from `from`, or null when no live referral rang that number. */
  doctorFor: async (from: string | null): Promise<string | null> => {
    const phone = normalizePhone(from);
    const recent = phone ? await CallRepository.latestToNumber(phone, addMinutes(now(), -BRIDGE_MATCH_WINDOW_MIN)) : null;
    const referral = recent ? await ReferralRepository.get(recent.referral_id) : null;
    const doctor = referral && CANCELLABLE.includes(referral.status) ? await ReferralRepository.referrer(referral.referrer_id) : null;
    // Server-only log: the desk's number stays out of the events the browser reads.
    const logged = { matched: !!doctor, referral_id: referral?.id ?? null, facility_id: recent?.facility_id ?? null };
    await WebhookLogRepository.log(null, "function:bridge", logged);
    return doctor?.phone_e164 ?? null;
  },
};
