import { describe, expect, it } from "vitest";
import type { Capability } from "@/lib/core/types";
import { dialPlan, type DialFacts } from "@/lib/modules/call/dial.helper";
import type { ReferralCtx } from "@/lib/modules/referral/referral.type";
import { attemptRow as attempt, facilityRow, referralRow, referrerRow } from "./support/fixtures";

// What each call purpose dials and says, tested without a database.

const need = (code: string, spoken_en: string): Capability => ({ code, label: code, spoken_en, category: "bed" });

const ctx: ReferralCtx = {
  referral: referralRow(),
  referrer: referrerRow(),
  origin: null,
  template: { case_type: "snakebite_neuro", label: "Snakebite", spoken_en: "suspected snakebite", default_capabilities: [], clinician_reviewed: true },
  needs: [need("icu", "an ICU bed"), need("ventilator", "a ventilator")],
};

const facility = facilityRow();

const facts = (o: Partial<DialFacts> = {}): DialFacts => ({ facility, day_only_codes: [], accepted: null, patient: null, ...o });

const PATIENT = { attendant_name: "Sunita", attendant_phone_e164: "+919845012345" };

describe("dialPlan", () => {
  it("dials the attempt's number for an availability call and keeps the family's number out of it", () => {
    const plan = dialPlan(ctx, attempt(), facts({ patient: PATIENT }));
    expect(plan.recipient).toBe("+911111111111");
    expect(Object.keys(plan.user_data)).not.toContain("attendant_name");
    expect(Object.values(plan.user_data).join(" ")).not.toContain("9845012345");
  });

  it("says nothing about the night when the hospital has every service round the clock", () => {
    expect(dialPlan(ctx, attempt(), facts()).user_data.night_note).toBe("");
  });

  it("names only the services this hospital has in the daytime, at night", () => {
    const note = dialPlan(ctx, attempt(), facts({ day_only_codes: ["ventilator"] })).user_data.night_note;
    expect(note).toBe("It is night, and this hospital usually has a ventilator only in the daytime.");
  });

  it("reads the accepted bed and desk into a hold-confirm call", () => {
    const accepted = { bed_type: "icu" as const, contact_person: "Sister Anita" };
    const data = dialPlan(ctx, attempt({ purpose: "hold_confirm" }), facts({ accepted })).user_data;
    expect(data.bed_phrase).toBe("the ICU bed");
    expect(data.accepted_by).toBe("Sister Anita");
    expect(data.contact_known).toBe("yes");
    expect(data.whatsapp_on_file).toBe("yes");
  });

  it("asks a hold-confirm call for the desk's name and WhatsApp when neither is on file", () => {
    const data = dialPlan(ctx, attempt({ purpose: "hold_confirm" }), facts({ facility: { ...facility, whatsapp_number: null } })).user_data;
    expect(data.contact_known).toBe("no");
    expect(data.whatsapp_on_file).toBe("no");
  });

  it("dials the attendant, not the attempt's masked number, for a family call", () => {
    const plan = dialPlan(ctx, attempt({ purpose: "family_update", to_number: "+91 ••••• ••345" }), facts({ patient: PATIENT }));
    expect(plan.recipient).toBe("+919845012345");
    expect(plan.user_data.attendant_name).toBe("Sunita");
    expect(plan.user_data.hospital_area).toBe("12 Lake Road, Bengaluru");
  });

  it("dials nobody for a family call when the attendant's number is gone", () => {
    expect(dialPlan(ctx, attempt({ purpose: "family_update" }), facts()).recipient).toBe("");
  });

  it("sends a release call no acuity and no patient details", () => {
    const plan = dialPlan(ctx, attempt({ purpose: "release" }), facts({ patient: PATIENT }));
    expect(plan.recipient).toBe("+911111111111");
    expect(plan.user_data.case_summary_short).not.toContain("critical");
    expect(Object.keys(plan.user_data)).not.toContain("attendant_name");
  });

  it("opens a consented test call with the test sentence in the hospital's language", () => {
    expect(dialPlan(ctx, attempt(), facts(), true).user_data.call_prefix).toContain("ಪರೀಕ್ಷಾ ಕರೆ");
    expect(dialPlan(ctx, attempt(), facts()).user_data.call_prefix).toBe("");
  });

  it("falls back to English for a language the agents don't speak", () => {
    const data = dialPlan(ctx, attempt({ call_language: "xx" }), facts(), true).user_data;
    expect(data.call_prefix).toContain("This is a test call");
  });
});
