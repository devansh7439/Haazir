import { describe, expect, it } from "vitest";

import { checkNote, normaliseNote } from "@/lib/modules/referral/summary.helper";
import { composeNote, EMPTY_CLINICAL, extraLimit, clinicalError, factsBody } from "../mobile/src/features/referral/clinical.helper";

// The app joins the "Condition now" taps into the note every hospital hears. The server reads that note aloud, so what
// the app writes must pass the server's note check, expand cleanly when spoken, and never exceed the 160 characters.

const everything = {
  conscious: "unconscious",
  breathing: "difficult",
  onset: "1to3",
  spo2: "88",
  bp: "90/60",
  given: ["oxygen", "iv", "asv", "firstaid"],
  airway: "intubated",
  gcs: "9",
  payer: "pmjay",
  medico: "no",
};

describe("the note built from the condition taps", () => {
  it("is empty when nothing is picked and keeps the doctor's own words", () => {
    expect(composeNote(EMPTY_CLINICAL, "")).toBe("");
    expect(composeNote(EMPTY_CLINICAL, " fang marks on left foot ")).toBe("fang marks on left foot");
  });

  it("puts the structured line first, then the doctor's words", () => {
    const note = composeNote(everything, "fang marks");
    expect(note.startsWith("unconscious, struggling to breathe, onset 1-3 hrs ago, BP 90/60")).toBe(true);
    expect(note.endsWith(". fang marks")).toBe(true);
  });

  it("passes the server's identifier check and is spoken in full words", () => {
    const note = composeNote(everything, "");
    expect(checkNote(note).blocked).toBe(false);
    const spoken = normaliseNote(note);
    expect(spoken).toContain("blood pressure 90/60");
    expect(spoken).toContain("anti-snake venom given");
    expect(spoken).toContain("1-3 hours ago");
  });

  it("never goes over 160 characters, however long the free text is", () => {
    expect(composeNote(everything, "x".repeat(400)).length).toBeLessThanOrEqual(160);
    expect(extraLimit(EMPTY_CLINICAL)).toBe(160);
  });

  it("leaves out readings that are not valid and says what is wrong", () => {
    const bad = { ...everything, spo2: "140", bp: "12080" };
    expect(composeNote(bad, "")).not.toContain("BP");
    expect(factsBody(bad)).not.toHaveProperty("spo2");
    expect(clinicalError(bad)).toMatch(/saturation/i);
    expect(clinicalError({ ...everything, gcs: "2" })).toMatch(/GCS/);
    expect(factsBody({ ...everything, gcs: "16" })).not.toHaveProperty("gcs");
    expect(clinicalError({ ...everything, bp: "12080" })).toMatch(/pressure/i);
    expect(clinicalError(everything)).toBeNull();
  });

  it("sends airway, SpO2, oxygen, GCS, payment and medico-legal as structured facts, not in the note", () => {
    expect(factsBody(everything)).toEqual({ airway: "intubated", spo2: 88, on_oxygen: true, gcs: 9, payer: "pmjay", medico_legal: false });
    const note = composeNote(everything, "");
    expect(note).not.toMatch(/SpO2|oxygen|intubated/i);
    expect(factsBody(EMPTY_CLINICAL)).toEqual({});
    // Unticked oxygen says nothing, rather than "no".
    expect(factsBody({ ...everything, given: ["iv"] })).not.toHaveProperty("on_oxygen");
  });
});
