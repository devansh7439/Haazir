import { phrase, t } from '../../lib/i18n';

// The handover a receiving doctor asks for after the vitals: pregnancy, how it happened, infection risk, blood, and who agreed
// to the transfer. Picked with taps; all optional. They go as structured fields (`handoverBody`), never into the note: the server
// reads pregnancy, mechanism, infection risk and blood need to every desk and keeps the rest for a desk that asks. Mirrors the web form.

export interface Handover {
  pregnancy: string;
  mechanism: string;
  infection: string;
  bloodNeeded: string;
  bloodGroup: string;
  consent: string;
  reason: string;
}

export const EMPTY_HANDOVER: Handover = { pregnancy: '', mechanism: '', infection: '', bloodNeeded: '', bloodGroup: '', consent: '', reason: '' };

type Choice = { value: string; label: ReturnType<typeof phrase> };

export const MECHANISM: readonly Choice[] = [
  { value: 'not_trauma', label: phrase('Not trauma') },
  { value: 'road_accident', label: phrase('Road accident') },
  { value: 'fall', label: phrase('Fall') },
  { value: 'assault', label: phrase('Assault') },
  { value: 'burn', label: phrase('Burn') },
  { value: 'penetrating', label: phrase('Penetrating injury') },
  { value: 'other', label: phrase('Other') },
];

export const INFECTION: readonly Choice[] = [
  { value: 'none', label: phrase('None') },
  { value: 'airborne', label: phrase('Airborne (isolate)') },
  { value: 'contact', label: phrase('Contact') },
  { value: 'bloodborne', label: phrase('Blood-borne') },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const CONSENT: readonly Choice[] = [
  { value: 'patient', label: phrase('Patient agreed') },
  { value: 'attendant', label: phrase('Attendant agreed') },
  { value: 'emergency_waiver', label: phrase('Emergency, cannot consent') },
];

export const REASON: readonly Choice[] = [
  { value: 'service_not_available', label: phrase('Service not available here') },
  { value: 'needs_higher_care', label: phrase('Needs higher care') },
  { value: 'no_bed', label: phrase('No bed here') },
  { value: 'other', label: phrase('Other') },
];

/** Pregnancy is a whole number of weeks from 1 to 45. Blank is fine. */
export const pregnancyValid = (weeks: string) => weeks === '' || (/^\d{1,2}$/.test(weeks) && Number(weeks) >= 1 && Number(weeks) <= 45);

/** What is wrong with the handover, as a line for the doctor; null when it is fine or blank. */
export const handoverError = (h: Handover): string | null => (pregnancyValid(h.pregnancy) ? null : t('Pregnancy is 1 to 45 weeks'));

/**
 * The handover as the request takes it. Blank is left out, so the server records "not stated"; "needs blood" can only be said
 * yes or no when the doctor picked it.
 */
export function handoverBody(h: Handover): Record<string, unknown> {
  return {
    ...(h.pregnancy && pregnancyValid(h.pregnancy) ? { pregnancy_weeks: Number(h.pregnancy) } : {}),
    ...(h.mechanism ? { trauma_mechanism: h.mechanism } : {}),
    ...(h.infection ? { infectious_risk: h.infection } : {}),
    ...(h.bloodNeeded ? { blood_needed: h.bloodNeeded === 'yes' } : {}),
    ...(h.bloodGroup ? { blood_group: h.bloodGroup } : {}),
    ...(h.consent ? { transfer_consent: h.consent } : {}),
    ...(h.reason ? { transfer_reason: h.reason } : {}),
  };
}
