/** The cases shown before "more": the commonest emergency referrals. */
export const FEATURED = ["snakebite_neuro", "stroke", "stemi", "head_injury", "obstetric_bleed", "preterm_newborn"];

// A small colour on each level: the words carry the meaning, the dot only reinforces it.
export const ACUITY = [
  { value: "critical", label: "Critical", dot: "#dc2626" },
  { value: "serious", label: "Serious", dot: "#f59e0b" },
  { value: "stable", label: "Stable", dot: "#16a34a" },
] as const;

export const SEX = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
] as const;

export const AGE_UNITS = [
  { value: "years", label: "Years" },
  { value: "months", label: "Months" },
  { value: "days", label: "Days" },
] as const;

export const AIRWAY = [
  { value: "unknown", label: "Not stated" },
  { value: "own", label: "Own airway" },
  { value: "intubated", label: "Intubated" },
] as const;

export const TRI = [
  { value: "unknown", label: "Not stated" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

export const PAYERS = [
  { value: "unknown", label: "Not stated" },
  { value: "free_govt", label: "Free (govt)" },
  { value: "pmjay", label: "Ayushman" },
  { value: "insurance", label: "Insurance" },
  { value: "cash", label: "Cash" },
] as const;

export const MECHANISMS = [
  { value: "unknown", label: "Not stated" },
  { value: "not_trauma", label: "Not trauma" },
  { value: "road_accident", label: "Road accident" },
  { value: "fall", label: "Fall" },
  { value: "assault", label: "Assault" },
  { value: "burn", label: "Burn" },
  { value: "penetrating", label: "Penetrating" },
  { value: "other", label: "Other" },
] as const;

export const INFECTIOUS = [
  { value: "unknown", label: "Not stated" },
  { value: "none", label: "None" },
  { value: "airborne", label: "Airborne (isolate)" },
  { value: "contact", label: "Contact" },
  { value: "bloodborne", label: "Blood-borne" },
] as const;

export const BLOOD_GROUPS = [
  { value: "unknown", label: "Not stated" },
  ...(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const).map((g) => ({ value: g, label: g })),
] as const;

export const CONSENTS = [
  { value: "none", label: "Not recorded" },
  { value: "patient", label: "Patient agreed" },
  { value: "attendant", label: "Attendant agreed" },
  { value: "emergency_waiver", label: "Emergency, cannot consent" },
] as const;

export const REASONS = [
  { value: "none", label: "Not stated" },
  { value: "service_not_available", label: "Service not available here" },
  { value: "needs_higher_care", label: "Needs higher care" },
  { value: "no_bed", label: "No bed here" },
  { value: "other", label: "Other" },
] as const;

export const RADII_KM =[20, 40, 60, 80, 120];
export const DEFAULT_RADIUS_KM = 40;
export const WIDE_RADIUS_KM = 80;
export const NOTE_MAX = 160;
