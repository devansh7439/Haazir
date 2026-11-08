import { z } from 'zod';
import { api } from './client';
import {
  CreatedSchema,
  PreviewSchema,
  REFERRAL_STATUSES,
  ReferralListSchema,
  ReferralViewSchema,
  type Outcome,
} from './schema';

// Every call the app makes about referrals and their calls, with its path and the shape of its answer in one place.
// Screens never build a URL. Each action's answer is checked, so a server change fails here instead of being ignored.

/** The body of the form: the case, the patient's clinical facts, and where to search from. Checked by the server. */
export type ReferralBody = Record<string, unknown>;

/** What a doctor recorded after phoning a desk themselves. */
export interface ManualOutcomeInput {
  outcome: Extract<Outcome, 'accepted' | 'conditional' | 'declined' | 'callback_later' | 'unclear'>;
  bed_type: string | null;
  ready_in_minutes: number | null;
  contact_person: string | null;
  conditions: string | null;
  decline_reason: string | null;
}

/** Which number to redial: a known contact, or the number that was dialled. */
export interface RedialInput {
  contact_id?: string;
  to_number?: string;
}

export type CloseReason = 'arrived' | 'hold_expired' | 'transferred_elsewhere' | 'other';

export const TickSchema = z.object({ changed: z.boolean(), actions: z.array(z.string()), status: z.enum(REFERRAL_STATUSES) });
// `options_ready` means the confirmation call could not be placed and the hospital can be chosen again.
export const SelectedSchema = z.object({ status: z.enum(['confirming', 'options_ready']), hold_attempt_id: z.string().nullable() });
const StatusSchema = z.object({ status: z.enum(REFERRAL_STATUSES) });
const WidenedSchema = z.object({ id: z.string(), code: z.string() });
const OkSchema = z.object({ ok: z.literal(true) });
// The server leaves both out when the attempt vanished between the write and the read; the write itself succeeded.
const ManualOutcomeSchema = z.object({ id: z.string().optional(), outcome: z.string().nullable().optional() });
const RedialSchema = z.object({ id: z.string(), status: z.string(), to_number: z.string() });

const post = <T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown = {}) =>
  api(path, schema, { method: 'POST', body });

export const ReferralRepository = {
  /** The organisation's referrals, newest first. */
  list: () => api('/api/referrals', ReferralListSchema),

  /** One referral's board: attempts, events, alerts and the server's clock. */
  get: (id: string) => api(`/api/referrals/${id}`, ReferralViewSchema),

  /** Asks the server to advance the referral (next wave, callbacks, hold expiry, missed webhooks). Safe to repeat. */
  tick: (id: string) => post(`/api/referrals/${id}/tick`, TickSchema),

  /** What hospitals would hear and which would be called, without creating anything. */
  preview: (body: ReferralBody, signal?: AbortSignal) => api('/api/referrals/preview', PreviewSchema, { body, signal }),

  /** Starts the search. The body's `client_request_id` makes a retry return the same referral. */
  create: (body: ReferralBody) => api('/api/referrals', CreatedSchema, { body }),

  /** The doctor picks a hospital that said yes; a confirmation call holds the bed. */
  select: (id: string, attemptId: string, force: boolean) => post(`/api/referrals/${id}/select`, SelectedSchema, { attempt_id: attemptId, force }),

  /** The doctor already spoke to the hospital: confirm the bed without a call. */
  confirmManually: (id: string, attemptId: string, contactPerson: string | null) =>
    post(`/api/referrals/${id}/confirm-manually`, StatusSchema, { attempt_id: attemptId, contact_person: contactPerson }),

  /** Stops the search and releases any hospital that said yes. */
  cancel: (id: string, reason: string) => post(`/api/referrals/${id}/cancel`, StatusSchema, { reason }),

  /** Ends a referral whose bed was held. */
  close: (id: string, reason: CloseReason) => post(`/api/referrals/${id}/close`, StatusSchema, { reason }),

  /** Starts a new referral for the same case with a wider radius; the answer names it. */
  widen: (id: string, radiusKm: number) => post(`/api/referrals/${id}/widen`, WidenedSchema, { radius_km: radiusKm }),

  /** Hides an alert (a desk asking for the doctor, a missed call) once the doctor has seen it. */
  dismissAlert: (id: string, eventId: number) => post(`/api/referrals/${id}/dismiss-alert`, OkSchema, { event_id: eventId }),

  /** Records what a desk told the doctor on a call the doctor made. */
  recordOutcome: (attemptId: string, input: ManualOutcomeInput) => post(`/api/attempts/${attemptId}/manual-outcome`, ManualOutcomeSchema, input),

  /** Calls a hospital again. The server allows two redials per hospital per referral. */
  redial: (attemptId: string, input: RedialInput) => post(`/api/attempts/${attemptId}/redial`, RedialSchema, input),
};
