import type { Attempt, Facility } from "@/lib/core/types";
import { callLanguage, facilityArea } from "@/lib/modules/call/call.helper";
import {
  arrivalCheckUserData, availabilityUserData, familyUserData, holdConfirmUserData, releaseUserData, type CallContext,
} from "@/lib/modules/call/user-data.helper";
import { shortSummaryOf } from "@/lib/modules/referral/referral.helper";
import type { PatientDetails, ReferralCtx } from "@/lib/modules/referral/referral.type";
import { describeKnownFacts, joinSpoken } from "@/lib/modules/referral/summary.helper";

/** What `CallService.dispatchCall` loads before a call. Each purpose reads only the part it needs. */
export interface DialFacts {
  facility: Facility | null;
  /** The needed services this hospital has only in the daytime. Loaded only at night, for an availability call. */
  day_only_codes: string[];
  /** The availability answer that a hold-confirm call follows up. */
  accepted: Pick<Attempt, "bed_type" | "contact_person"> | null;
  /** Server-only identifiers. Loaded only for a family call (CLAUDE.md rule 1). */
  patient: Pick<PatientDetails, "attendant_name" | "attendant_phone_e164"> | null;
}

/** The number to dial and the `user_data` the agent receives. */
export interface DialPlan {
  recipient: string;
  user_data: Record<string, string>;
}

/** Tells the agent which of the needed services this hospital has only in the daytime; empty when there are none. */
const nightNote = (ctx: ReferralCtx, dayOnlyCodes: string[]): string => {
  const spoken = ctx.needs.filter((n) => dayOnlyCodes.includes(n.code)).map((n) => n.spoken_en);
  return spoken.length > 0 ? `It is night, and this hospital usually has ${joinSpoken(spoken)} only in the daytime.` : "";
};

/**
 * What to dial and say for one call, chosen by its purpose. Pure: everything it reads is in `facts`. Only a family call
 * dials a number other than the attempt's, because the attendant's real number stays in `patient_details`.
 */
export const dialPlan = (ctx: ReferralCtx, attempt: Attempt, facts: DialFacts, consentedTest?: boolean): DialPlan => {
  const r = ctx.referral;
  const callCtx: CallContext = {
    attempt_id: attempt.id,
    doctor_name: ctx.referrer.name,
    referring_facility: ctx.origin?.name ?? "the referring centre",
    facility_name: facts.facility?.name ?? "your hospital",
    referral_code: r.code,
    language: callLanguage(attempt.call_language),
    consented_test: consentedTest,
  };
  switch (attempt.purpose) {
    case "availability":
      return {
        recipient: attempt.to_number,
        user_data: availabilityUserData(callCtx, {
          case_summary: r.spoken_summary,
          needs_spoken: joinSpoken(ctx.needs.map((n) => n.spoken_en)),
          eta_minutes: attempt.eta_minutes,
          known_facts: describeKnownFacts(r, r),
          night_note: nightNote(ctx, facts.day_only_codes),
        }),
      };
    case "hold_confirm":
      return {
        recipient: attempt.to_number,
        user_data: holdConfirmUserData(callCtx, {
          case_summary_short: shortSummaryOf(ctx),
          bed_type: facts.accepted?.bed_type ?? null,
          accepted_by: facts.accepted?.contact_person ?? null,
          eta_minutes: attempt.eta_minutes,
          whatsapp_on_file: !!facts.facility?.whatsapp_number,
        }),
      };
    case "arrival_check":
      return {
        recipient: attempt.to_number,
        user_data: arrivalCheckUserData(callCtx, { case_summary_short: shortSummaryOf(ctx), eta_minutes: attempt.eta_minutes }),
      };
    case "family_update":
      return {
        recipient: facts.patient?.attendant_phone_e164 ?? "",
        user_data: familyUserData(callCtx, {
          attendant_name: facts.patient?.attendant_name ?? null,
          hospital_area: facilityArea(facts.facility) || (facts.facility?.name ?? ""),
          eta_minutes: attempt.eta_minutes,
        }),
      };
    case "release":
      return { recipient: attempt.to_number, user_data: releaseUserData(callCtx, { case_summary_short: shortSummaryOf(ctx, false) }) };
  }
};
