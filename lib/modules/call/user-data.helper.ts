// What each Bolna agent receives in user_data (docs/05-voice-agents.md §3).
// Availability calls must never carry patient identifiers: the inputs below don't even accept them.

import { HOLD_BUFFER_MIN, TIMEZONE } from "@/lib/core/config";
import { spokenCode, spokenName } from "@/lib/modules/referral/summary.helper";

export const CALL_PREFIX_TEST: Record<string, string> = {
  en: "This is a test call agreed with your hospital. ",
  hi: "यह आपके अस्पताल की अनुमति से किया गया एक टेस्ट कॉल है। ",
  kn: "ಇದು ನಿಮ್ಮ ಆಸ್ಪತ್ರೆಯ ಅನುಮತಿಯೊಂದಿಗೆ ಮಾಡುತ್ತಿರುವ ಪರೀಕ್ಷಾ ಕರೆ. ",
};

const ACCEPTED_BY_FALLBACK: Record<string, string> = {
  en: "your desk",
  hi: "आपकी डेस्क",
  kn: "ನಿಮ್ಮ ಡೆಸ್ಕ್",
};

const BED_PHRASE: Record<string, string> = {
  icu_with_ventilator: "the ICU bed with a ventilator",
  icu: "the ICU bed",
  hdu: "the high-dependency bed",
  nicu: "the NICU bed",
  emergency_only: "the emergency bed",
  ward: "the ward bed",
};

export function bedPhrase(bedType: string | null | undefined): string {
  return (bedType && BED_PHRASE[bedType]) || "the bed";
}

export interface CallContext {
  attempt_id: string;
  doctor_name: string;
  referring_facility: string;
  facility_name: string;
  referral_code: string;
  language: string;
  consented_test?: boolean;
}

function base(ctx: CallContext) {
  return {
    attempt_id: ctx.attempt_id,
    doctor_name: spokenName(ctx.doctor_name),
    referring_facility: spokenName(ctx.referring_facility),
    facility_name: spokenName(ctx.facility_name),
    referral_code_spoken: spokenCode(ctx.referral_code),
    timezone: TIMEZONE,
    call_prefix: ctx.consented_test ? CALL_PREFIX_TEST[ctx.language] ?? CALL_PREFIX_TEST.en : "",
  };
}

export function availabilityUserData(
  ctx: CallContext,
  c: { case_summary: string; needs_spoken: string; eta_minutes: number | null },
): Record<string, string> {
  return {
    ...base(ctx),
    case_summary: c.case_summary,
    needs_spoken: c.needs_spoken,
    eta_minutes: String(c.eta_minutes ?? ""),
  };
}

/**
 * Hold-confirm user_data. contact_known and whatsapp_on_file are "yes" or "no", so the agent asks only for what is missing.
 */
export function holdConfirmUserData(
  ctx: CallContext,
  c: { case_summary_short: string; bed_type: string | null; accepted_by: string | null; eta_minutes: number | null; whatsapp_on_file: boolean },
): Record<string, string> {
  const eta = c.eta_minutes ?? 0;
  const contact = c.accepted_by?.trim() || null;
  const flag = (v: boolean): "yes" | "no" => (v ? "yes" : "no");
  return {
    ...base(ctx),
    case_summary_short: c.case_summary_short,
    bed_phrase: bedPhrase(c.bed_type),
    accepted_by: contact ?? ACCEPTED_BY_FALLBACK[ctx.language] ?? ACCEPTED_BY_FALLBACK.en,
    // Every saved question is seconds off the call while the patient waits (docs/05-voice-agents.md §6).
    contact_known: flag(contact !== null),
    whatsapp_on_file: flag(c.whatsapp_on_file),
    eta_minutes: String(eta),
    hold_until_spoken: `for the next ${eta + HOLD_BUFFER_MIN} minutes`,
  };
}

export function releaseUserData(ctx: CallContext, c: { case_summary_short: string }): Record<string, string> {
  return { ...base(ctx), case_summary_short: c.case_summary_short };
}

/**
 * Family update call (C1). This call goes to the attendant themselves, so their name is used; it never goes to a
 * hospital. No patient name is sent.
 */
export function familyUserData(
  ctx: CallContext,
  c: { attendant_name: string | null; hospital_area: string; eta_minutes: number | null },
): Record<string, string> {
  return {
    attempt_id: ctx.attempt_id,
    attendant_name: c.attendant_name ?? "",
    doctor_name: spokenName(ctx.doctor_name),
    hospital_name: spokenName(ctx.facility_name),
    hospital_area: c.hospital_area,
    referral_code_spoken: spokenCode(ctx.referral_code),
    eta_minutes: String(c.eta_minutes ?? ""),
    timezone: TIMEZONE,
  };
}
