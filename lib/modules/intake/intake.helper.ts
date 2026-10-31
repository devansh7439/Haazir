// Turns a doctor's WhatsApp message or voice-note transcript into referral form fields (C2).
// Deterministic keyword rules, no LLM: the doctor always reviews the form before anything is called.
// The note is only kept when the identifier guard finds nothing at all, so drafts never carry names or numbers.

import { checkNote } from "@/lib/modules/referral/summary.helper";
import type { Acuity, AgeUnit, Sex } from "@/lib/core/types";

export interface ParsedIntake {
  case_type: string | null;
  required_capabilities: string[];
  acuity: Acuity | null;
  age_value: number | null;
  age_unit: AgeUnit;
  sex: Sex;
  note: string | null;
  note_dropped: boolean;
  matched: string[]; // what the parser recognised, shown to the doctor
}

const CASES: Array<{ case_type: string; label: string; re: RegExp }> = [
  { case_type: "snakebite_haemo", label: "snakebite with bleeding", re: /\b(snake|krait|cobra|viper|saanp|saap|haavu)\b[\s\S]*\b(bleed|bleeding|haemorrh|hemorrh|wbct|clot)/i },
  { case_type: "snakebite_neuro", label: "snakebite", re: /\b(snake ?bite|snake|krait|cobra|saanp|saap|haavu|asv)\b/i },
  { case_type: "stemi", label: "heart attack", re: /\b(stemi|heart attack|myocardial|chest pain|\bmi\b|cardiac arrest)/i },
  { case_type: "stroke", label: "stroke", re: /\b(stroke|hemipleg|paralys|facial droop|slurred)/i },
  { case_type: "head_injury", label: "head injury", re: /\b(head injury|head trauma|\btbi\b|skull|gcs \d)/i },
  { case_type: "polytrauma", label: "major trauma", re: /\b(polytrauma|rta|road traffic|accident|multiple fractures|trauma)\b/i },
  { case_type: "preterm_newborn", label: "newborn", re: /\b(preterm|premature|newborn|neonate|neonatal|nicu)\b/i },
  { case_type: "obstetric_bleed", label: "obstetric bleeding", re: /\b(pph|postpartum|post-partum|antepartum|obstetric|placenta|eclampsia)\b/i },
  { case_type: "major_burns", label: "burns", re: /\b(burns?|scald)\b/i },
  { case_type: "poisoning", label: "poisoning", re: /\b(poison|organophosph|\bop\b|pesticide|insecticide|overdose)\b/i },
];

const ACUITY: Array<[Acuity, RegExp]> = [
  ["critical", /\b(critical|very serious|unstable|crashing|gasping|intubat|sinking|gambhir)\b/i],
  ["serious", /\b(serious|sick|deteriorat)\b/i],
  ["stable", /\b(stable|stabili[sz]ed)\b/i],
];

/** Reads a doctor's free-text WhatsApp message into a form draft. Drops a note that may hold a name or number. */
export function parseIntake(text: string, templates: Array<{ case_type: string; default_capabilities: string[] }>): ParsedIntake {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  const matched: string[] = [];

  const c = CASES.find((x) => x.re.test(t));
  const template = c ? templates.find((x) => x.case_type === c.case_type) : undefined;
  if (c) matched.push(c.label);

  const acuity = ACUITY.find(([, re]) => re.test(t))?.[0] ?? null;
  if (acuity) matched.push(acuity);

  let age_value: number | null = null;
  let age_unit: AgeUnit = "years";
  const ageM =
    t.match(/\b(\d{1,3})\s*(?:-|\s)?\s*(days?|d|months?|mo|years?|yrs?|y|yo)\b(?:\s*old)?/i) ??
    t.match(/\bage[d:]?\s*(\d{1,3})\b/i) ??
    t.match(/\b(\d{1,3})\s*(?:\/|,)\s*[mf]\b/i);
  if (ageM) {
    const v = parseInt(ageM[1], 10);
    const unit = (ageM[2] ?? "y").toLowerCase();
    age_unit = unit.startsWith("d") ? "days" : unit.startsWith("mo") ? "months" : "years";
    if (v <= 120) {
      age_value = v;
      matched.push(`${v} ${age_unit}`);
    }
  }

  let sex: Sex = "unknown";
  if (/\b(female|woman|lady|girl|mahila|aurat|\d{1,3}\s*(?:\/|,)?\s*f)\b/i.test(t)) sex = "female";
  else if (/\b(male|man|gent|boy|aadmi|purush|\d{1,3}\s*(?:\/|,)?\s*m)\b/i.test(t)) sex = "male";
  if (sex !== "unknown") matched.push(sex);

  // Keep the note only if the guard finds no number, ID, email or possible name.
  const check = checkNote(t);
  const keepNote = t.length > 0 && !check.blocked && check.warnings.length === 0;
  const note = keepNote ? (t.length > 160 ? `${t.slice(0, 157).replace(/\s+\S*$/, "")}…` : t) : null;

  return {
    case_type: c?.case_type ?? null,
    required_capabilities: template?.default_capabilities ?? [],
    acuity,
    age_value,
    age_unit,
    sex,
    note,
    note_dropped: t.length > 0 && !keepNote,
    matched,
  };
}
