import { describe, expect, it } from "vitest";
import { buildShortSummary, buildSpokenSummary, checkNote, describeKnownFacts, describeVitals, describeWho, joinSpoken, normaliseNote, spokenCode, spokenName } from "@/lib/modules/referral/summary.helper";

const KRAIT = {
  age_value: 34,
  age_unit: "years" as const,
  sex: "male" as const,
  case_spoken: "suspected snakebite with neurotoxic signs",
  acuity: "critical" as const,
  note: "Drooping eyelids and trouble swallowing 2 hrs after bite. Given 10 vials of ASV.",
  needs_spoken_list: ["an ICU bed", "a ventilator"],
};

describe("spoken summary", () => {
  it("produces exactly the krait-bite string from docs/02-architecture.md §8", () => {
    expect(buildSpokenSummary(KRAIT)).toBe(
      "Man aged 34, suspected snakebite with neurotoxic signs, critical. Drooping eyelids and trouble swallowing 2 hours after bite. Given 10 vials of anti-snake venom. Needs an ICU bed and a ventilator.",
    );
  });

  it("omits the note and needs when empty", () => {
    expect(buildSpokenSummary({ ...KRAIT, note: "", needs_spoken_list: [] })).toBe(
      "Man aged 34, suspected snakebite with neurotoxic signs, critical.",
    );
  });

  it("expands clinical abbreviations", () => {
    expect(normaliseNote("BP 90/60, SpO2 88%, GCS 9 + vomiting 1 hr")).toBe(
      "Blood pressure 90/60, oxygen saturation 88%, G C S 9 and vomiting 1 hour.",
    );
  });

  it("describes the patient by age band", () => {
    expect(describeWho(34, "years", "female")).toBe("Woman aged 34");
    expect(describeWho(15, "years", "male")).toBe("Teenage boy, 15 years");
    expect(describeWho(6, "years", "unknown")).toBe("Child aged 6");
    expect(describeWho(3, "days", "female")).toBe("Baby, 3 days old");
    expect(describeWho(1, "months", "male")).toBe("Baby, 1 month old");
    expect(describeWho(null, "years", "unknown")).toBe("Patient");
  });

  it("joins needs with commas and 'and'", () => {
    expect(joinSpoken(["a", "b", "c"])).toBe("a, b and c");
  });

  it("builds the short summary used by hold and release calls", () => {
    expect(buildShortSummary(KRAIT)).toBe("man aged 34, suspected snakebite with neurotoxic signs, critical");
    expect(buildShortSummary(KRAIT, false)).toBe("man aged 34, suspected snakebite with neurotoxic signs");
  });

  it("speaks codes digit by digit and drops the demo marker", () => {
    expect(spokenCode("R-4821")).toBe("R 4 8 2 1");
    expect(spokenName("Tamarind District Hospital (Demo)")).toBe("Tamarind District Hospital");
  });
});

describe("identifier guard", () => {
  it("blocks a note with 10 digits", () => {
    expect(checkNote("Call son on 9845012345").blocked).toBe(true);
    expect(checkNote("Call son on 98450 12345").blocked).toBe(true);
  });
  it("blocks Aadhaar-like numbers and emails", () => {
    expect(checkNote("ID 1234 5678 9012").blocked).toBe(true);
    // A name given on the form, in any case or script, as a whole word only.
    expect(checkNote("RAMESH is drowsy", ["Ramesh Gowda"]).blocked).toBe(true);
    expect(checkNote("रमेश बेहोश है", ["रमेश"]).blocked).toBe(true);
    expect(checkNote("Ramesh is drowsy").blocked).toBe(false);
    expect(checkNote("Rameshwaram transfer", ["Ramesh"]).blocked).toBe(false);
    // A placeholder or a relation is not a name.
    expect(checkNote("baby is male, wife of patient present", ["Baby of unknown male", "Wife", null, ""]).blocked).toBe(false);
    expect(checkNote("mail ramesh@example.com").blocked).toBe(true);
  });
  it("allows ordinary clinical numbers", () => {
    const c = checkNote("BP 90/60, HR 120, given 10 vials ASV at 01:30, GCS 9");
    expect(c.blocked).toBe(false);
    expect(c.warnings).toEqual([]);
  });
  it("warns, but does not block, on honorific + name", () => {
    const c = checkNote("Mr. Ramesh collapsed at home");
    expect(c.blocked).toBe(false);
    expect(c.warnings.length).toBe(1);
  });
});

describe("clinical facts", () => {
  it("reads the bedside status after the note and before the needs", () => {
    const facts = { airway: "intubated" as const, spo2: 88, on_oxygen: true, gcs: 9 };
    expect(buildSpokenSummary({ ...KRAIT, facts })).toBe(
      "Man aged 34, suspected snakebite with neurotoxic signs, critical. Drooping eyelids and trouble swallowing 2 hours after bite. Given 10 vials of anti-snake venom. Intubated. Oxygen saturation 88 percent on oxygen. G C S 9. Needs an ICU bed and a ventilator.",
    );
  });

  it("leaves the summary unchanged when the doctor gave no facts", () => {
    const plain = buildSpokenSummary(KRAIT);
    expect(buildSpokenSummary({ ...KRAIT, facts: { airway: "unknown", spo2: null, gcs: null, on_oxygen: null } })).toBe(plain);
    expect(describeVitals(undefined)).toBe("");
  });

  it("says room air, own airway and oxygen without a reading", () => {
    expect(describeVitals({ airway: "own", spo2: 96, on_oxygen: false })).toBe("Not intubated. Oxygen saturation 96 percent on room air.");
    expect(describeVitals({ on_oxygen: true })).toBe("On oxygen.");
  });

  it("gives the agent every fact it may answer, and 'not stated' for the rest", () => {
    expect(describeKnownFacts({ airway: "intubated", spo2: 88, gcs: 9, on_oxygen: true, payer: "pmjay", medico_legal: false })).toBe(
      "Airway: intubated. Oxygen saturation: 88 percent. On oxygen: yes. G C S: 9. Payment: Ayushman Bharat card. Medico-legal case: no.",
    );
    expect(describeKnownFacts(undefined)).toBe(
      "Airway: not stated. Oxygen saturation: not stated. On oxygen: not stated. G C S: not stated. Payment: not stated. Medico-legal case: not stated.",
    );
  });
});
