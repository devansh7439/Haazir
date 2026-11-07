import { describe, expect, it } from "vitest";
import { buildSlip, type SlipInput } from "@/lib/modules/referral/slip.helper";
import { referralRow, referrerRow } from "./support/fixtures";

// The referral slip, tested without a database.

const input = (o: Partial<SlipInput> = {}): SlipInput => ({
  referral: referralRow({ status: "confirmed", transfer_reason: "needs_higher_care", ambulance_status: "dispatched" }),
  referrer: referrerRow({ registration_no: "KMC 12345", registration_council: "Karnataka Medical Council" }),
  origin_name: "Hoskote PHC",
  case_label: "Snakebite",
  needs_labels: ["ICU bed", "Ventilator"],
  hospital_name: "Tamarind District Hospital",
  hospital_address: "12 Lake Road",
  desk_number: "+918000000000",
  contact_person: "Sister Anita",
  bed_type: "icu",
  eta_minutes: 18,
  ...o,
});

describe("buildSlip", () => {
  it("names the sender, the hospital and the reason", () => {
    const slip = buildSlip(input());
    expect(slip.code).toBe("R-4821");
    expect(slip.from).toEqual({ doctor: "Dr. Meera Rao (Demo)", facility: "Hoskote PHC", registration: "Karnataka Medical Council KMC 12345", verification: "verified" });
    expect(slip.to.hospital).toBe("Tamarind District Hospital");
    expect(slip.reason).toBe("Needs a higher level of care");
  });

  it("says so when no consent, reason or registration was recorded", () => {
    const slip = buildSlip(input({ referral: referralRow(), referrer: referrerRow({ verification_status: "unverified" }) }));
    expect(slip.consent).toBeNull();
    expect(slip.reason).toBe("Not recorded");
    expect(slip.from.registration).toBeNull();
    expect(slip.lines).toContain("Consent to transfer: not recorded");
    expect(slip.lines[1]).toContain("registration not given; registration not given");
  });

  it("records who consented, by the label a receiving doctor would read", () => {
    const referral = referralRow({ transfer_consent: "attendant", transfer_consent_at: "2026-10-31T10:05:00Z" });
    const slip = buildSlip(input({ referral }));
    expect(slip.consent).toEqual({ by: "the attendant", at: "2026-10-31T10:05:00Z" });
    expect(slip.lines).toContain("Consent to transfer: given by the attendant");
  });

  it("does not count a consent without a time as given", () => {
    expect(buildSlip(input({ referral: referralRow({ transfer_consent: "patient", transfer_consent_at: null }) })).consent).toBeNull();
  });

  it("drops the facility and contact parts of the lines when they are missing", () => {
    const slip = buildSlip(input({ origin_name: null, hospital_address: null, contact_person: null }));
    expect(slip.lines[1]).toMatch(/^From: Dr\. Meera Rao \(Demo\) \(/);
    expect(slip.lines[2]).toBe("To: Tamarind District Hospital · desk +918000000000");
  });

  it("reads the ambulance status in words", () => {
    expect(buildSlip(input()).lines).toContain("Ambulance: dispatched");
    expect(buildSlip(input({ referral: referralRow({ ambulance_status: "not_available" }) })).lines).toContain("Ambulance: none available, other transport");
  });

  it("holds no patient name or phone", () => {
    const text = JSON.stringify(buildSlip(input()));
    expect(text).not.toMatch(/patient_name|attendant_phone|attendant_name/);
  });
});
