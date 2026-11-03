/** The cases shown before "more cases": the commonest emergency referrals. */
export const FEATURED = ["snakebite_neuro", "head_injury", "stemi", "stroke", "preterm_newborn", "obstetric_bleed"];

export const ACUITY = [
  { value: "critical", label: "Critical" },
  { value: "serious", label: "Serious" },
  { value: "stable", label: "Stable" },
] as const;

export const SEX = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
] as const;

export const AGE_UNIT = [
  { value: "years", label: "Years" },
  { value: "months", label: "Months" },
  { value: "days", label: "Days" },
] as const;

export const RADII_KM = [20, 40, 60, 80, 120];
export const DEFAULT_RADIUS_KM = 40;
export const NOTE_MAX = 160;
