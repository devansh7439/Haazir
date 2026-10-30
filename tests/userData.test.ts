import { describe, expect, it } from "vitest";
import { availabilityUserData, holdConfirmUserData, releaseUserData } from "@/lib/userData";

const ctx = {
  attempt_id: "5b1f0c7e-1f7a-4c3e-9a51-0c9d1e2f3a4b",
  doctor_name: "Dr. Meera Rao (Demo)",
  referring_facility: "Hoskote PHC (Demo)",
  facility_name: "Tamarind District Hospital (Demo)",
  referral_code: "R-4821",
  language: "kn",
};

const FORBIDDEN_KEYS = ["patient_name", "attendant_name", "attendant_phone", "attendant_phone_e164", "attendant_language"];
const PHONE = /(?:\d[\s-]?){8}\d/;

describe("user_data privacy", () => {
  const data = availabilityUserData(ctx, {
    case_summary: "Man aged 34, suspected snakebite with neurotoxic signs, critical. Needs an ICU bed and a ventilator.",
    needs_spoken: "an ICU bed and a ventilator",
    eta_minutes: 18,
  });

  it("availability user_data never contains patient identifiers or phone numbers", () => {
    for (const k of FORBIDDEN_KEYS) expect(Object.keys(data)).not.toContain(k);
    for (const v of Object.values(data)) expect(v).not.toMatch(PHONE);
  });

  it("matches the documented shape", () => {
    expect(data).toMatchObject({
      attempt_id: ctx.attempt_id,
      doctor_name: "Dr. Meera Rao",
      referring_facility: "Hoskote PHC",
      facility_name: "Tamarind District Hospital",
      referral_code_spoken: "R 4 8 2 1",
      eta_minutes: "18",
      timezone: "Asia/Kolkata",
      call_prefix: "",
    });
    for (const v of Object.values(data)) expect(typeof v).toBe("string");
  });

  it("adds the consented-test sentence in the call language", () => {
    const d = availabilityUserData({ ...ctx, consented_test: true }, { case_summary: "x", needs_spoken: "y", eta_minutes: 1 });
    expect(d.call_prefix).toContain("ಪರೀಕ್ಷಾ ಕರೆ");
  });

  it("hold-confirm falls back to 'your desk' per language and states the hold window", () => {
    const h = holdConfirmUserData(ctx, { case_summary_short: "man aged 34", bed_type: "icu_with_ventilator", accepted_by: null, eta_minutes: 18 });
    expect(h.accepted_by).toBe("ನಿಮ್ಮ ಡೆಸ್ಕ್");
    expect(h.bed_phrase).toBe("the ICU bed with a ventilator");
    expect(h.hold_until_spoken).toBe("for the next 48 minutes");
  });

  it("release user_data has no identifiers either", () => {
    const r = releaseUserData(ctx, { case_summary_short: "man aged 34, suspected snakebite" });
    for (const k of FORBIDDEN_KEYS) expect(Object.keys(r)).not.toContain(k);
  });
});
