import { describe, expect, it } from "vitest";
import { buildShortSummary, buildSpokenSummary, checkNote, describeWho, joinSpoken, normaliseNote, spokenCode, spokenName } from "@/lib/summary";

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
