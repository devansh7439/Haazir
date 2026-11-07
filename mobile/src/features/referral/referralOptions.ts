import { phrase } from '../../lib/i18n';

/** The cases shown before "more cases": the commonest emergency referrals. */
export const FEATURED = ['snakebite_neuro', 'head_injury', 'stemi', 'stroke', 'preterm_newborn', 'obstetric_bleed'];

/** The three urgency levels, from the most to the least urgent. */
export const ACUITY = [
  { value: 'critical', label: phrase('Critical') },
  { value: 'serious', label: phrase('Serious') },
  { value: 'stable', label: phrase('Stable') },
] as const;

/** The choices for a patient's sex. */
export const SEX = [
  { value: 'male', label: phrase('Male') },
  { value: 'female', label: phrase('Female') },
  { value: 'other', label: phrase('Other') },
  { value: 'unknown', label: phrase('Unknown') },
] as const;

/** The units a patient's age can be given in. */
export const AGE_UNIT = [
  { value: 'years', label: phrase('Years') },
  { value: 'months', label: phrase('Months') },
  { value: 'days', label: phrase('Days') },
] as const;

/** The languages a family can be called in. */
export const FAMILY_LANGUAGES = ['en', 'hi', 'kn', 'ta', 'te'];

/** The search distances a doctor can pick, in kilometres. */
export const RADII_KM = [20, 40, 60, 80, 120];
/** The search distance before a doctor has chosen their own. */
export const DEFAULT_RADIUS_KM = 40;
/** The most characters the note for hospitals may have. */
export const NOTE_MAX = 160;

/** The private patient and family fields. They are never spoken on calls. */
export interface PatientFields {
  patient_name: string;
  attendant_name: string;
  attendant_phone: string;
  attendant_language: string;
  /** The attendant agreed to their details being shared and to a WhatsApp update. */
  attendant_consent: boolean;
}

/** Patient and family details before anything is typed. */
export const EMPTY_PATIENT: PatientFields = {
  patient_name: '',
  attendant_name: '',
  attendant_phone: '',
  attendant_language: 'en',
  attendant_consent: false,
};
