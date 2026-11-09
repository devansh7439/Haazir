// Copied from lib/ui/display.ts with the web-only parts removed. tests/mobile-parity.test.ts fails when the two drift apart.
import type { AttemptStatus, Outcome, Purpose } from '../api/schema';

// Client-safe display helpers (docs/06-ui-spec.md §2.1). Colour never carries meaning alone: every state has an icon and text.

/** The name of each language a hospital desk or a family is called in. */
export const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English',
  kn: 'Kannada',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  mr: 'Marathi',
};

/** The name of each kind of bed a hospital can offer. */
export const BED_LABEL: Record<string, string> = {
  icu_with_ventilator: 'ICU + ventilator',
  icu: 'ICU',
  hdu: 'HDU',
  nicu: 'NICU',
  emergency_only: 'Emergency only',
  ward: 'Ward',
  none: 'No bed',
  unknown: 'Bed type not stated',
};

export type Tone = 'grey' | 'blue' | 'amber' | 'green' | 'green-cond' | 'red' | 'purple' | 'slate' | 'dark' | 'orange' | 'held';

/** Icon keys the app draws as line icons (never emoji). */
export type IconKey = 'queued' | 'ringing' | 'oncall' | 'check' | 'x' | 'phone' | 'callback' | 'redirect' | 'ban' | 'help' | 'lock';

export interface AttemptLike {
  purpose: Purpose;
  status: AttemptStatus;
  outcome: Outcome | null;
  needs_review: boolean;
  decline_reason: string | null;
  callback_due_at: string | Date | null;
  alternate_number: string | null;
  answered_at: string | Date | null;
}

export type Group = 'accepted' | 'in_progress' | 'waiting' | 'not_available';

export interface Display {
  tone: Tone;
  icon: IconKey;
  text: string;
  group: Group;
}

/** A time as hh:mm in India, or an empty string when there is none. */
export function clock(d: string | Date | null | undefined): string {
  if (!d) return '';
  const format = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false } as const;
  return new Intl.DateTimeFormat('en-IN', format).format(new Date(d));
}

/** Seconds as m:ss, for the timers on the board. */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function readableReason(r: string | null): string {
  if (!r) return '';
  return r.replace(/^(no_bed|no_ventilator|no_specialist|full|not_our_case|other):\s*/i, '').replace(/_/g, ' ');
}

/** What to show for one hospital's call: its tone, icon, words and the group it belongs to. */
export function attemptDisplay(a: AttemptLike, nowMs: number): Display {
  if (a.needs_review) return { tone: 'orange', icon: 'help', text: 'Check the recording', group: 'not_available' };
  switch (a.outcome) {
    case 'accepted':
      return { tone: 'green', icon: 'check', text: 'Accepted', group: 'accepted' };
    case 'conditional':
      return { tone: 'green-cond', icon: 'check', text: 'Accepted with a condition', group: 'accepted' };
    case 'declined':
      const why = a.decline_reason ? ` · ${readableReason(a.decline_reason)}` : '';
      return { tone: 'red', icon: 'x', text: `Declined${why}`, group: 'not_available' };
    case 'needs_doctor':
      return { tone: 'purple', icon: 'phone', text: 'Wants to talk to you', group: 'waiting' };
    case 'callback_later':
      return { tone: 'slate', icon: 'callback', text: `Calling back at ${clock(a.callback_due_at)}`, group: 'waiting' };
    case 'redirected':
      const to = a.alternate_number ? ` to ${a.alternate_number}` : '';
      return { tone: 'slate', icon: 'redirect', text: `Redirected${to}`, group: 'waiting' };
    case 'ivr_blocked':
      return { tone: 'dark', icon: 'ban', text: 'Phone menu: add a direct number', group: 'not_available' };
    case 'unclear':
      return { tone: 'orange', icon: 'help', text: 'Check the recording', group: 'not_available' };
    case 'hold_confirmed':
      return { tone: 'held', icon: 'lock', text: 'Bed held', group: 'accepted' };
    case 'hold_declined':
      return { tone: 'red', icon: 'x', text: 'Bed no longer available', group: 'not_available' };
    case 'release_ack':
      return { tone: 'grey', icon: 'check', text: 'Released', group: 'not_available' };
    case 'arrival_confirmed':
      return { tone: 'green', icon: 'check', text: 'Patient arrived', group: 'accepted' };
    case 'not_arrived':
      return { tone: 'purple', icon: 'help', text: 'Not arrived yet', group: 'waiting' };
  }
  switch (a.status) {
    case 'queued':
      return { tone: 'grey', icon: 'queued', text: 'Queued', group: 'waiting' };
    case 'dialing':
    case 'ringing':
      return { tone: 'blue', icon: 'ringing', text: 'Ringing', group: 'in_progress' };
    case 'in_progress':
    case 'wrapping_up': {
      const secs = a.answered_at ? (nowMs - new Date(a.answered_at).getTime()) / 1000 : 0;
      return { tone: 'amber', icon: 'oncall', text: `On call · ${mmss(secs)}`, group: 'in_progress' };
    }
    case 'no_answer':
      return { tone: 'dark', icon: 'ban', text: 'No answer', group: 'not_available' };
    case 'busy':
      return { tone: 'dark', icon: 'ban', text: 'Busy', group: 'not_available' };
    case 'failed':
      return { tone: 'dark', icon: 'ban', text: 'Call failed', group: 'not_available' };
    case 'canceled':
      return { tone: 'dark', icon: 'ban', text: 'Cancelled', group: 'not_available' };
    default:
      return { tone: 'orange', icon: 'help', text: 'Check the recording', group: 'not_available' };
  }
}

/** The words, tone and liveness of each status a referral can have. */
export const REFERRAL_STATUS: Record<string, { text: string; tone: Tone; live?: boolean }> = {
  draft: { text: 'Draft', tone: 'grey' },
  searching: { text: 'Calling hospitals', tone: 'blue', live: true },
  options_ready: { text: 'Options ready', tone: 'green' },
  confirming: { text: 'Confirming bed', tone: 'amber', live: true },
  confirmed: { text: 'Bed held', tone: 'held' },
  exhausted: { text: 'No hospital accepted', tone: 'red' },
  cancelled: { text: 'Cancelled', tone: 'grey' },
  closed: { text: 'Closed', tone: 'grey' },
};

/** A hospital's name without the demo marker, or a plain word when it has none. */
export function shortName(name: string | null | undefined): string {
  return (name ?? 'Hospital').replace(/\s*\(Demo\)\s*/i, '');
}

/** Whether "Widen to 80 km" would search further than this referral did. */
export const canWiden = (radiusKm: number | undefined): boolean => radiusKm === undefined || radiusKm < 80;

/**
 * What the manual-outcome form opens with: only an answer already on record, never a guess, so a stray Save can't record a
 * yes (CLAUDE.md rule 10). A call's answer waiting for review counts as no answer: Save would clear the review.
 */
export function manualOutcomeStart(a: { outcome: string | null; bed_type: string | null; needs_review: boolean }) {
  const known = !a.needs_review && ['accepted', 'conditional', 'declined', 'callback_later'].includes(a.outcome ?? '');
  const bed = a.bed_type && !['none', 'unknown'].includes(a.bed_type) ? a.bed_type : '';
  return { outcome: known ? a.outcome! : '', bed: known ? bed : '' };
}

/** Whether the manual-outcome form can be saved: an outcome is chosen and, for a yes, the bed it is for. */
export const manualOutcomeReady = (outcome: string, bed: string): boolean =>
  outcome !== '' && (!['accepted', 'conditional'].includes(outcome) || bed !== '');

export interface EventLike {
  type: string;
  payload: Record<string, unknown>;
}

/** Plain-words timeline line for an event, or null to hide it. */
export function eventText(e: EventLike, facilityName: (id: unknown) => string): string | null {
  const p = e.payload ?? {};
  const f = () => facilityName(p.facility_id);
  switch (e.type) {
    case 'referral_created':
      return 'Referral created';
    case 'wave_dispatched':
      return `Calling ${(p.facility_ids as unknown[] | undefined)?.length ?? 0} hospitals (round ${p.wave})`;
    case 'call_queued':
      return p.purpose === 'hold_confirm' ? `Calling ${f()} to confirm the bed` : null;
    case 'call_answered':
      return p.purpose === 'availability' ? `${f()} answered` : null;
    case 'call_ended':
      if (p.status === 'no_answer') return `${f()}: no answer`;
      if (p.status === 'busy') return `${f()}: busy`;
      return p.status === 'failed' ? `${f()}: call failed` : null;
    case 'outcome_recorded': {
      const o = String(p.outcome);
      const words: Record<string, string> = {
        accepted: 'accepted',
        conditional: 'accepted with a condition',
        declined: 'declined',
        redirected: 'gave another number',
        unclear: 'answer unclear',
        ivr_blocked: 'reached a phone menu',
        needs_doctor: 'wants to talk to you',
        callback_later: 'asked for a callback',
      };
      return `${f()} ${words[o] ?? o}${p.source === 'manual' ? ' (entered by doctor)' : ''}`;
    }
    case 'options_ready':
      return `First yes after ${mmss(Number(p.ttfa_seconds ?? 0))}`;
    case 'doctor_callback_requested':
      return `${f()} wants to talk to you${p.reason ? `: “${p.reason}”` : ''}`;
    case 'inbound_callback':
      return `${p.facility_name ?? 'A hospital'} called back${p.message ? `: “${p.message}”` : ''}`;
    case 'callback_scheduled':
      return `${f()} asked to be called back at ${clock(p.due_at as string)}`;
    case 'redial_dispatched':
      return `Calling ${f()} again (${p.reason})`;
    case 'needs_review':
      return `${f()}: answer unclear (call says ${p.function_outcome}, transcript says ${p.extraction_outcome}). Check the recording`;
    case 'facility_selected':
      return `You selected ${f()}`;
    case 'hold_confirmed':
      const ask = p.contact_person ? ` · ask for ${p.contact_person}` : '';
      return `${f()} confirmed the bed${ask}${p.manual ? ' (confirmed by phone)' : ''}`;
    case 'hold_declined':
      return `${f()} can no longer take the patient`;
    case 'handoff_sent':
      return `WhatsApp to ${p.audience === 'receiving_facility' ? 'hospital' : p.audience === 'referrer' ? 'you' : 'family'}: ${p.status}`;
    case 'release_dispatched':
      return `Releasing ${f()}`;
    case 'arrival_check_dispatched':
      return `Asking ${f()} whether the patient has arrived`;
    case 'arrival_confirmed':
      return `${f()} says the patient has arrived`;
    case 'not_arrived':
      return `${f()} says the patient has not arrived yet`;
    case 'hold_expired':
      return 'Hold expired';
    case 'referral_exhausted':
      return 'No hospital accepted';
    case 'referral_cancelled':
      return `Referral cancelled${p.reason ? `: ${p.reason}` : ''}`;
    case 'referral_closed':
      return `Referral closed: ${String(p.reason).replace(/_/g, ' ')}`;
    case 'portal_mismatch':
      return `${f()}: desk said ${p.desk_outcome}, but ${p.detail} (${p.source})`;
    case 'bed_request_sent':
      return `WhatsApp bed request to ${f()}: ${p.status}`;
    case 'family_call_dispatched':
      return p.reason === 'missed_call'
        ? 'Family gave a missed call: calling them back with the update'
        : 'Calling the family with the update';
    case 'status_recovered':
      return `${f()}: call status recovered from Bolna (missed webhook)`;
    case 'alert':
      return String(p.message ?? p.kind);
    default:
      return null;
  }
}
