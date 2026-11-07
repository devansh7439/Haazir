// Deterministic spoken case summary (docs/02-architecture.md §8). Never LLM-written.
// Format: "{who}, {case_spoken}, {acuity}. {note_normalised} Needs {needs_spoken}."

import type { Acuity, AgeUnit, ClinicalFacts, HandoverFacts, Payer, Sex } from "@/lib/core/types";

export interface SummaryInput {
  age_value: number | null | undefined;
  age_unit: AgeUnit;
  sex: Sex;
  case_spoken: string;
  acuity: Acuity;
  note?: string | null;
  needs_spoken_list: string[]; // capabilities.spoken_en, in order
  /** Airway, SpO2, GCS and oxygen are read after the note. Left out, the summary is unchanged. */
  facts?: Partial<ClinicalFacts>;
  /** Pregnancy, trauma mechanism, infectious risk and blood needed are read after the vitals. Left out, the summary is unchanged. */
  handover?: Partial<HandoverFacts>;
}

/** How the patient is described aloud, for example "Man aged 34". */
export function describeWho(age: number | null | undefined, unit: AgeUnit, sex: Sex): string {
  const male = sex === "male";
  const female = sex === "female";
  if (age === null || age === undefined) {
    return male ? "Male patient" : female ? "Female patient" : "Patient";
  }
  if (unit === "days" || unit === "months") {
    const word = unit === "days" ? "day" : "month";
    return `Baby, ${age} ${word}${age === 1 ? "" : "s"} old`;
  }
  if (age >= 18) return `${male ? "Man" : female ? "Woman" : "Patient"} aged ${age}`;
  if (age >= 13) return `${male ? "Teenage boy" : female ? "Teenage girl" : "Teenager"}, ${age} years`;
  if (age >= 1) return `${male ? "Boy" : female ? "Girl" : "Child"} aged ${age}`;
  return "Baby, under a year old";
}

const EXPANSIONS: Array<[RegExp, string]> = [
  [/\bASV\b/g, "anti-snake venom"],
  [/\bSpO2\b/gi, "oxygen saturation"],
  [/\bGCS\b/g, "G C S"],
  [/\bBP\b/g, "blood pressure"],
  [/(\d)\s*(?:hrs|hr|h)\b/gi, "$1 hours"],
  [/\b(?:hrs|hr)\b/gi, "hours"],
  [/\s*\+\s*/g, " and "],
];

/** The note made speakable: abbreviations expanded, a capital first letter and a full stop. */
export function normaliseNote(note: string | null | undefined): string {
  let text = (note ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  for (const [re, rep] of EXPANSIONS) text = text.replace(re, rep);
  text = text.replace(/\b1 hours\b/g, "1 hour");
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += ".";
  return text;
}

/** A list read aloud: "a, b and c". */
export function joinSpoken(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The bedside status read to every desk: "Intubated. Oxygen saturation 88 percent on oxygen. G C S 9."
 * Only what the doctor gave; empty when nothing was.
 */
export function describeVitals(f: Partial<ClinicalFacts> | undefined): string {
  if (!f) return "";
  const parts: string[] = [];
  if (f.airway === "intubated") parts.push("Intubated.");
  else if (f.airway === "own") parts.push("Not intubated.");
  if (f.spo2 !== null && f.spo2 !== undefined) {
    const oxygen = f.on_oxygen === true ? " on oxygen" : f.on_oxygen === false ? " on room air" : "";
    parts.push(`Oxygen saturation ${f.spo2} percent${oxygen}.`);
  } else if (f.on_oxygen === true) parts.push("On oxygen.");
  if (f.gcs !== null && f.gcs !== undefined) parts.push(`G C S ${f.gcs}.`);
  return parts.join(" ");
}

const MECHANISM_SPOKEN: Record<string, string> = {
  road_accident: "Road accident.",
  fall: "Fall from height.",
  assault: "Assault.",
  burn: "Burn injury.",
  penetrating: "Penetrating injury.",
};
const INFECTIOUS_SPOKEN: Record<string, string> = {
  airborne: "Airborne infection risk, needs isolation.",
  contact: "Contact infection risk.",
  bloodborne: "Blood-borne infection risk.",
};

/**
 * What a desk needs before it can say yes: pregnancy, how the injury happened, infection risk and blood. Only what
 * the doctor gave; empty when nothing was.
 */
export function describeHandover(h: Partial<HandoverFacts> | undefined): string {
  if (!h) return "";
  const parts: string[] = [];
  if (h.pregnancy_weeks) parts.push(`Pregnant, ${h.pregnancy_weeks} weeks.`);
  if (h.trauma_mechanism && MECHANISM_SPOKEN[h.trauma_mechanism]) parts.push(MECHANISM_SPOKEN[h.trauma_mechanism]);
  if (h.infectious_risk && INFECTIOUS_SPOKEN[h.infectious_risk]) parts.push(INFECTIOUS_SPOKEN[h.infectious_risk]);
  if (h.blood_needed === true) parts.push("Needs blood.");
  return parts.join(" ");
}

const PAYER_SPOKEN: Record<Payer, string> = {
  free_govt: "free government treatment",
  pmjay: "Ayushman Bharat card",
  insurance: "private insurance",
  cash: "cash payment",
  unknown: "not stated",
};

const yesNo = (v: boolean | null | undefined): string => (v === true ? "yes" : v === false ? "no" : "not stated");

/**
 * Everything the agent may say if a desk asks, one fact per sentence, "not stated" where the doctor gave nothing. The agent
 * answers only from this and the summary (docs/05-voice-agents.md §4), so it never invents a vital sign.
 */
export function describeKnownFacts(f: Partial<ClinicalFacts> | undefined, h?: Partial<HandoverFacts>): string {
  const airway = f?.airway === "intubated" ? "intubated" : f?.airway === "own" ? "not intubated" : "not stated";
  const spo2 = f?.spo2 === null || f?.spo2 === undefined ? "not stated" : `${f.spo2} percent`;
  return [
    `Airway: ${airway}.`,
    `Oxygen saturation: ${spo2}.`,
    `On oxygen: ${yesNo(f?.on_oxygen)}.`,
    `G C S: ${f?.gcs ?? "not stated"}.`,
    `Payment: ${PAYER_SPOKEN[f?.payer ?? "unknown"]}.`,
    `Medico-legal case: ${yesNo(f?.medico_legal)}.`,
    ...(h && hasHandover(h) ? describeKnownHandover(h) : []),
  ].join(" ");
}

/** Whether the doctor gave any handover fact; a referral without one keeps the shorter known-facts text. */
export const hasHandover = (h: Partial<HandoverFacts> | undefined): boolean =>
  !!h &&
  (!!h.pregnancy_weeks ||
    (!!h.trauma_mechanism && h.trauma_mechanism !== "unknown") ||
    (!!h.infectious_risk && h.infectious_risk !== "unknown") ||
    !!h.treatment_given?.trim() ||
    (!!h.blood_group && h.blood_group !== "unknown") ||
    h.blood_needed !== null && h.blood_needed !== undefined);

const describeKnownHandover = (h: Partial<HandoverFacts>): string[] => [
  `Pregnancy: ${h.pregnancy_weeks ? `${h.pregnancy_weeks} weeks` : "not stated"}.`,
  `How it happened: ${h.trauma_mechanism && h.trauma_mechanism !== "unknown" ? h.trauma_mechanism.replace("_", " ") : "not stated"}.`,
  `Infection risk: ${h.infectious_risk && h.infectious_risk !== "unknown" ? h.infectious_risk : "not stated"}.`,
  `Blood group: ${h.blood_group && h.blood_group !== "unknown" ? h.blood_group : "not stated"}. Needs blood: ${yesNo(h.blood_needed)}.`,
  `Treatment given: ${h.treatment_given?.trim() || "not stated"}.`,
];

/** The exact sentence the voice agent reads to every hospital. Built from fields, never by an LLM (CLAUDE.md rule 6). */
export function buildSpokenSummary(input: SummaryInput): string {
  const who = describeWho(input.age_value, input.age_unit, input.sex);
  const parts = [`${who}, ${input.case_spoken}, ${input.acuity}.`];
  const note = normaliseNote(input.note);
  if (note) parts.push(note);
  const vitals = describeVitals(input.facts);
  if (vitals) parts.push(vitals);
  const handover = describeHandover(input.handover);
  if (handover) parts.push(handover);
  const needs = joinSpoken(input.needs_spoken_list);
  if (needs) parts.push(`Needs ${needs}.`);
  return parts.join(" ");
}

/** "man aged 34, suspected snakebite with neurotoxic signs, critical" — used by hold and release calls. */
export function buildShortSummary(input: Omit<SummaryInput, "note" | "needs_spoken_list">, includeAcuity = true): string {
  const who = describeWho(input.age_value, input.age_unit, input.sex);
  const text = `${who}, ${input.case_spoken}${includeAcuity ? `, ${input.acuity}` : ""}`;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Identifier guard on the free-text note
// ---------------------------------------------------------------------------

export interface NoteCheck {
  blocked: boolean;
  errors: string[];
  warnings: string[];
}

const PHONE_LIKE = /(?:\d[\s-]?){8}\d/; // 9 or more digits, allowing single spaces or dashes between them
const AADHAAR_LIKE = /\d{4}\s?\d{4}\s?\d{4}/;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const HONORIFIC_NAME = /\b(?:Mr|Mrs|Ms|Shri|Smt|Kumari)\.?\s+[A-Z][a-z]+/;

/** Whether a clinical note may be read aloud: blocked when it looks like a phone number, an ID, an email or a name. */
export function checkNote(note: string | null | undefined): NoteCheck {
  const text = note ?? "";
  const errors: string[] = [];
  const warnings: string[] = [];
  if (AADHAAR_LIKE.test(text)) errors.push("The note looks like it contains an ID number. Remove it.");
  else if (PHONE_LIKE.test(text)) errors.push("The note looks like it contains a phone number. Remove it.");
  if (EMAIL.test(text)) errors.push("The note contains an email address. Remove it.");
  if (HONORIFIC_NAME.test(text)) warnings.push("The note may contain a name. Hospitals hear this note before they accept.");
  return { blocked: errors.length > 0, errors, warnings };
}

/** "R-4821" → "R 4 8 2 1", so it is read digit by digit. */
export function spokenCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, "").split("").join(" ");
}

/** Strip the "(Demo)" marker before anything is spoken. */
export function spokenName(name: string): string {
  return name.replace(/\s*\(Demo\)\s*/gi, " ").replace(/\s+/g, " ").trim();
}
