/** The cases shown before "more": the commonest emergency referrals. */
export const FEATURED = ["snakebite_neuro", "head_injury", "stemi", "stroke", "preterm_newborn", "obstetric_bleed"];

export const ACUITY = [
  { value: "critical", label: "Critical", dot: "bg-zinc-900" },
  { value: "serious", label: "Serious", dot: "bg-zinc-500" },
  { value: "stable", label: "Stable", dot: "bg-zinc-300" },
] as const;

export const SEX = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
] as const;

export const RADII_KM = [20, 40, 60, 80, 120];
