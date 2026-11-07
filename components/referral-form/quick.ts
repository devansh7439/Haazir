import { INTAKE_PATTERNS } from "@/lib/modules/intake/intake.helper";
import { NOTE_MAX } from "./options";

const AGE = /\b\d{1,3}\s?[mf]\b|\b\d{1,3}\s*(?:-|\s)?\s*(?:days?|months?|mo|years?|yrs?|yo)\b(?:\s*old)?|\bage[d:]?\s*\d{1,3}\b/gi;
const SEX_WORDS = /\b(?:male|female|man|woman|lady|boy|girl)\b/gi;

/** What is left of a clause once the case, acuity, age and sex words are taken out. */
const leftover = (clause: string): string => {
  let s = clause;
  for (const re of [...INTAKE_PATTERNS.cases, ...INTAKE_PATTERNS.acuity]) s = s.replace(new RegExp(re.source, "gi"), " ");
  return s.replace(AGE, " ").replace(SEX_WORDS, " ").replace(/[\s,.;:/-]+/g, " ").trim();
};

/**
 * The clinical note from a typed sentence: the clauses that say something beyond the case, acuity, age and sex, which the form
 * already holds. "34M snakebite, ptosis 2 hrs, 10 vials ASV, critical" leaves "ptosis 2 hrs, 10 vials ASV".
 */
export function clinicalNote(text: string): string {
  const kept = text
    .split(/[,.;\n]+/)
    .map((c) => c.trim())
    .filter((c) => c && leftover(c));
  const note = kept.join(", ");
  return note.length > NOTE_MAX ? `${note.slice(0, NOTE_MAX - 1).replace(/\s+\S*$/, "")}…` : note;
}
