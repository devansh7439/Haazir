import { phrase, t } from '../../lib/i18n';

/** What the form still needs before it can be sent, as the hint under the button; null when nothing is missing. */
export function missingStep(caseType: string, acuity: string, needs: readonly string[]): string | null {
  if (!caseType) return t('Choose a case');
  if (!acuity) return t('Set how urgent it is');
  if (needs.length === 0 && caseType !== 'other') return t('Add at least one need');
  return null;
}

/** The steps of the form, in order. The review is the last: it lists the hospitals and sends. */
export const STEPS = [phrase('Patient'), phrase('Case'), phrase('Needs'), phrase('Search'), phrase('Review')] as const;
export const REVIEW_STEP = STEPS.length - 1;

/** What each step's card is called, and the line of help under it. One entry per step in STEPS. */
export const STEP_CARD = [
  { title: phrase('Patient'), hint: phrase('Hospitals hear all of this on the call except the private details.') },
  { title: phrase('Case'), hint: phrase('Hospitals hear the case and your note on the call.') },
  { title: phrase('What must the hospital have?'), hint: phrase('Filled from the case. Tap to change.') },
  { title: phrase('Where to search'), hint: phrase('Hospitals are ranked by distance from where you search.') },
  { title: phrase('Review and send'), hint: phrase('Haazir phones every capable hospital at once.') },
];

/** What stops the doctor going on from a step, as the line under Next; null when they can. */
export function stepBlocker(
  step: number,
  input: {
    caseType: string;
    acuity: string;
    needs: readonly string[];
    ageOk: boolean;
    clinicalError: string | null;
    noteError: string | null;
  },
): string | null {
  if (step === 0) {
    if (!input.ageOk) return t('Age must be a whole number');
    if (!input.acuity) return t('Set how urgent it is');
    if (input.clinicalError) return input.clinicalError;
  }
  if (step === 1) {
    if (!input.caseType) return t('Choose a case');
    if (input.noteError) return input.noteError;
  }
  if (step === 2 && input.needs.length === 0 && input.caseType !== 'other') return t('Add at least one need');
  return null;
}

/** The line under "Find a bed": what is missing, else why it cannot call, else how many hospitals it will phone at once. */
export function sendHint(input: { missing: string | null; hasPreview: boolean; willCall: number; callsReady: boolean }): string {
  if (input.missing) return input.missing;
  if (input.hasPreview && input.willCall === 0) return t('No hospital to call');
  if (!input.callsReady) return t('Calls are off on this server');
  return input.willCall === 1 ? t('Phones 1 hospital at once') : t('Phones {count} hospitals at once', { count: input.willCall });
}

/** Whether an age field holds nothing or a whole number of up to three digits. */
export const isValidAge = (age: string): boolean => age === '' || /^\d{1,3}$/.test(age);
