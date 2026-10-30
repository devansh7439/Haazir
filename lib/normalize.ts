// Normalising untrusted values from Bolna function calls and console forms.
// Every function param arrives as a string; Bolna may also send unreplaced "%(name)s" tokens.

import { AVAILABILITY_OUTCOMES, BED_TYPES, type AvailabilityOutcome, type BedType } from "./types";

const MISSING = new Set(["", "none", "null", "undefined", "nil", "n/a", "na"]);
const UNREPLACED = /^%\([A-Za-z0-9_]+\)s$/;

/** Trimmed string, or null for "", "None", "null", "undefined" and unreplaced %(name)s tokens. */
export function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (MISSING.has(s.toLowerCase()) || UNREPLACED.test(s)) return null;
  return s;
}

export function cleanParams<T extends Record<string, unknown>>(params: T): { [K in keyof T]: string | null } {
  const out = {} as { [K in keyof T]: string | null };
  for (const k of Object.keys(params) as Array<keyof T>) out[k] = clean(params[k]);
  return out;
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, "twenty five": 25, "twenty-five": 25, thirty: 30, "forty five": 45, "forty-five": 45,
  forty: 40, fifty: 50, sixty: 60, "half an hour": 30, "an hour": 60, "one hour": 60,
};

/** "15", "15 min", "fifteen" → 15; anything else → null. */
export function parseMinutes(value: unknown): number | null {
  const s = clean(value);
  if (!s) return null;
  const digits = s.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  const lower = s.toLowerCase();
  const phrases = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length);
  for (const p of phrases) if (lower.includes(p)) return NUMBER_WORDS[p];
  return null;
}

const E164 = /^\+[1-9][0-9]{7,14}$/;

export function isE164(value: string | null | undefined): boolean {
  return !!value && E164.test(value);
}

/** Indian 10-digit numbers become +91…; numbers with a country code keep it. Returns null if invalid. */
export function normalizePhone(value: unknown): string | null {
  const s = clean(value);
  if (!s) return null;
  const hasPlus = s.trim().startsWith("+");
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;
  let out: string;
  if (hasPlus) out = `+${digits}`;
  else if (digits.length === 10) out = `+91${digits}`;
  else if (digits.length === 11 && digits.startsWith("0")) out = `+91${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith("91")) out = `+${digits}`;
  else if (digits.startsWith("00")) {
    digits = digits.slice(2);
    out = `+${digits}`;
  } else out = `+${digits}`;
  return isE164(out) ? out : null;
}

/** "+91 ••••• ••301" — enough to recognise a number without exposing it. */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const tail = digits.slice(-3);
  const cc = value.startsWith("+91") ? "+91 " : "+";
  return `${cc}••••• ••${tail}`;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Unknown or garbled outcomes become "unclear" — never a guess at "accepted". */
export function normalizeOutcome(value: unknown): AvailabilityOutcome {
  const s = clean(value);
  if (!s) return "unclear";
  const v = slug(s);
  const aliases: Record<string, AvailabilityOutcome> = {
    accept: "accepted",
    yes: "accepted",
    conditionally_accepted: "conditional",
    accepted_with_condition: "conditional",
    decline: "declined",
    rejected: "declined",
    no: "declined",
    redirect: "redirected",
    ivr: "ivr_blocked",
    ivr_or_recording: "ivr_blocked",
  };
  if ((AVAILABILITY_OUTCOMES as readonly string[]).includes(v)) return v as AvailabilityOutcome;
  return aliases[v] ?? "unclear";
}

export function normalizeBedType(value: unknown): BedType | null {
  const s = clean(value);
  if (!s) return null;
  const v = slug(s);
  if ((BED_TYPES as readonly string[]).includes(v)) return v as BedType;
  if (v.includes("icu") && v.includes("vent")) return "icu_with_ventilator";
  return "unknown";
}

export function normalizeYesNo(value: unknown): "yes" | "no" | null {
  const s = clean(value)?.toLowerCase();
  if (!s) return null;
  if (["yes", "y", "true", "confirmed", "haan", "ha", "houdu"].includes(s)) return "yes";
  if (["no", "n", "false", "declined", "nahi", "illa"].includes(s)) return "no";
  return null;
}

/** "R4821", "r 4 8 2 1", "R-4821" → "R-4821". */
export function normalizeReferralCode(value: unknown): string | null {
  const s = clean(value);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (digits.length !== 4) return null;
  return `R-${digits}`;
}
