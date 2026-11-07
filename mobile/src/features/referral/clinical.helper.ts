import { phrase, t } from '../../lib/i18n';
import { NOTE_MAX } from './referralOptions';

// What an emergency desk asks first when a referral comes in: is the patient awake, are they breathing, how long ago did it
// start, the last readings, and what has been done. Picked here with taps and joined into the note that every hospital hears,
// so the sentence is built from fixed words (the note rules and abbreviation expansion of the server still apply).
// Airway, oxygen saturation, oxygen, GCS, payment and medico-legal are not in the note: they go as structured fields (`factsBody`),
// which the server reads once in the summary and gives the agent to answer a desk's follow-up questions.

export interface Clinical {
  conscious: string;
  breathing: string;
  onset: string;
  spo2: string;
  bp: string;
  given: string[];
  airway: string;
  gcs: string;
  payer: string;
  medico: string;
}

export const EMPTY_CLINICAL: Clinical = {
  conscious: '',
  breathing: '',
  onset: '',
  spo2: '',
  bp: '',
  given: [],
  airway: '',
  gcs: '',
  payer: '',
  medico: '',
};

type Choice = { value: string; label: ReturnType<typeof phrase>; spoken: string };

export const CONSCIOUS: readonly Choice[] = [
  { value: 'awake', label: phrase('Awake'), spoken: 'awake' },
  { value: 'drowsy', label: phrase('Drowsy'), spoken: 'drowsy' },
  { value: 'unconscious', label: phrase('Unconscious'), spoken: 'unconscious' },
];

export const BREATHING: readonly Choice[] = [
  { value: 'normal', label: phrase('Normal'), spoken: 'breathing normally' },
  { value: 'difficult', label: phrase('Struggling'), spoken: 'struggling to breathe' },
  { value: 'none', label: phrase('Not breathing alone'), spoken: 'not breathing on own' },
];

export const ONSET: readonly Choice[] = [
  { value: 'lt1', label: phrase('Under 1 hr'), spoken: 'onset under 1 hr ago' },
  { value: '1to3', label: phrase('1 to 3 hrs'), spoken: 'onset 1-3 hrs ago' },
  { value: '3to6', label: phrase('3 to 6 hrs'), spoken: 'onset 3-6 hrs ago' },
  { value: 'gt6', label: phrase('Over 6 hrs'), spoken: 'onset over 6 hrs ago' },
];

export const GIVEN: readonly Choice[] = [
  { value: 'oxygen', label: phrase('On oxygen'), spoken: 'on oxygen' },
  { value: 'iv', label: phrase('IV line in'), spoken: 'IV line in' },
  { value: 'asv', label: phrase('Anti-snake venom given'), spoken: 'ASV given' },
  { value: 'firstaid', label: phrase('First aid given'), spoken: 'first aid given' },
];

export const AIRWAY: readonly Choice[] = [
  { value: 'own', label: phrase('Own airway'), spoken: 'own airway' },
  { value: 'intubated', label: phrase('Intubated'), spoken: 'intubated' },
];

export const PAYER: readonly Choice[] = [
  { value: 'free_govt', label: phrase('Free (govt)'), spoken: 'free government' },
  { value: 'pmjay', label: phrase('Ayushman'), spoken: 'Ayushman Bharat' },
  { value: 'insurance', label: phrase('Insurance'), spoken: 'insurance' },
  { value: 'cash', label: phrase('Cash'), spoken: 'cash' },
];

export const YES_NO: readonly Choice[] = [
  { value: 'yes', label: phrase('Yes'), spoken: 'yes' },
  { value: 'no', label: phrase('No'), spoken: 'no' },
];

const spokenOf = (choices: readonly Choice[], value: string) => choices.find((c) => c.value === value)?.spoken;

/** Oxygen saturation is a whole number up to 100; blood pressure is "systolic/diastolic". Blank is fine. */
export const spo2Valid = (spo2: string) => spo2 === '' || (/^\d{1,3}$/.test(spo2) && Number(spo2) > 0 && Number(spo2) <= 100);
export const bpValid = (bp: string) => bp === '' || /^\d{2,3}\/\d{2,3}$/.test(bp);
/** Glasgow Coma Scale is a whole number from 3 to 15. Blank is fine. */
export const gcsValid = (gcs: string) => gcs === '' || (/^\d{1,2}$/.test(gcs) && Number(gcs) >= 3 && Number(gcs) <= 15);

/** What is wrong with the readings, as a line for the doctor; null when they are fine or blank. */
export function clinicalError(c: Clinical): string | null {
  if (!spo2Valid(c.spo2)) return t('Oxygen saturation is a number up to 100');
  if (!bpValid(c.bp)) return t('Blood pressure looks like 120/80');
  if (!gcsValid(c.gcs)) return t('GCS is a number from 3 to 15');
  return null;
}

/** The structured part of the note, in the order a desk wants it: "unconscious, struggling to breathe, onset 1-3 hrs ago, BP 90/60". */
export function clinicalLine(c: Clinical): string {
  return [
    spokenOf(CONSCIOUS, c.conscious),
    spokenOf(BREATHING, c.breathing),
    spokenOf(ONSET, c.onset),
    c.bp && bpValid(c.bp) ? `BP ${c.bp}` : undefined,
    // Oxygen goes as a structured fact, not in the note.
    ...GIVEN.filter((g) => g.value !== 'oxygen' && c.given.includes(g.value)).map((g) => g.spoken),
  ]
    .filter(Boolean)
    .join(', ');
}

/** How many characters of free text still fit once the structured part is in the note. */
export function extraLimit(c: Clinical): number {
  const line = clinicalLine(c);
  return line ? Math.max(0, NOTE_MAX - line.length - 2) : NOTE_MAX;
}

/** The whole note: the structured line, then the doctor's own words, never longer than the server allows. */
export function composeNote(c: Clinical, extra: string): string {
  const line = clinicalLine(c);
  const rest = extra.trim().slice(0, extraLimit(c));
  return [line, rest].filter(Boolean).join('. ');
}

/**
 * The structured facts for the request: airway, oxygen saturation, oxygen, GCS, payment, medico-legal. Left out when blank,
 * so the server records "not stated". "On oxygen" can only be said yes; unticked is not the same as "no".
 */
export function factsBody(c: Clinical): Record<string, unknown> {
  return {
    ...(c.airway ? { airway: c.airway } : {}),
    ...(c.spo2 && spo2Valid(c.spo2) ? { spo2: Number(c.spo2) } : {}),
    ...(c.given.includes('oxygen') ? { on_oxygen: true } : {}),
    ...(c.gcs && gcsValid(c.gcs) ? { gcs: Number(c.gcs) } : {}),
    ...(c.payer ? { payer: c.payer } : {}),
    ...(c.medico ? { medico_legal: c.medico === 'yes' } : {}),
  };
}
