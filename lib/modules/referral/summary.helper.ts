// Deterministic spoken case summary (docs/02-architecture.md §8). Never LLM-written.
// Format: "{who}, {case_spoken}, {acuity}. {note_normalised} Needs {needs_spoken}."

import type { Acuity, AgeUnit, Sex } from "@/lib/core/types";

export interface SummaryInput {
  age_value: number | null | undefined;
  age_unit: AgeUnit;
  sex: Sex;
  case_spoken: string;
  acuity: Acuity;
  note?: string | null;
  needs_spoken_list: string[]; // capabilities.spoken_en, in order
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

/** The exact sentence the voice agent reads to every hospital. Built from fields, never by an LLM (CLAUDE.md rule 6). */
export function buildSpokenSummary(input: SummaryInput): string {
  const who = describeWho(input.age_value, input.age_unit, input.sex);
  const parts = [`${who}, ${input.case_spoken}, ${input.acuity}.`];
  const note = normaliseNote(input.note);
  if (note) parts.push(note);
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
