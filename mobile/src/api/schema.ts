import { z } from 'zod';

// What the Haazir server sends, checked at runtime so a mismatch shows as one clear error instead of a crash on a
// card. tests/mobile-contract.test.ts runs the server's real output through these schemas. No React Native imports:
// the root test suite loads this file too.

/** Postgres `numeric` columns reach JSON as strings ("12.4"), though the server's own types say number. */
const numeric = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)]).transform(Number);

const iso = z.string();
const isoOrNull = z.string().nullable();

export const REFERRAL_STATUSES = [
  'draft',
  'searching',
  'options_ready',
  'confirming',
  'confirmed',
  'exhausted',
  'cancelled',
  'closed',
] as const;
export const ATTEMPT_STATUSES = [
  'queued',
  'dialing',
  'ringing',
  'in_progress',
  'wrapping_up',
  'completed',
  'no_answer',
  'busy',
  'failed',
  'canceled',
] as const;
export const PURPOSES = ['availability', 'hold_confirm', 'release', 'family_update', 'arrival_check'] as const;
export const OUTCOMES = [
  'accepted',
  'conditional',
  'declined',
  'redirected',
  'needs_doctor',
  'callback_later',
  'ivr_blocked',
  'unclear',
  'hold_confirmed',
  'hold_declined',
  'release_ack',
  'family_informed',
  'arrival_confirmed',
  'not_arrived',
] as const;
export const ACUITIES = ['critical', 'serious', 'stable'] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
export type Purpose = (typeof PURPOSES)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type Acuity = (typeof ACUITIES)[number];
export type Sex = 'male' | 'female' | 'other' | 'unknown';
export type AgeUnit = 'days' | 'months' | 'years';

const Referral = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(REFERRAL_STATUSES),
  acuity: z.enum(ACUITIES),
  /** Left out by a server older than this app. */
  search_radius_km: z.number().optional(),
  current_wave: z.number(),
  selected_facility_id: z.string().nullable(),
  selected_attempt_id: z.string().nullable(),
  hold_expires_at: isoOrNull,
  first_acceptance_at: isoOrNull,
  confirmed_at: isoOrNull,
  closed_at: isoOrNull,
  close_reason: z.string().nullable(),
  spoken_summary: z.string(),
  created_at: iso,
});

const Attempt = z.object({
  id: z.string(),
  facility_id: z.string().nullable(),
  contact_id: z.string().nullable(),
  parent_attempt_id: z.string().nullable(),
  purpose: z.enum(PURPOSES),
  wave: z.number(),
  rank: z.number().nullable(),
  distance_km: numeric.nullable(),
  eta_minutes: z.number().nullable(),
  to_number: z.string(),
  call_language: z.string(),
  status: z.enum(ATTEMPT_STATUSES),
  outcome: z.enum(OUTCOMES).nullable(),
  extraction_outcome: z.string().nullable(),
  needs_review: z.boolean(),
  bed_type: z.string().nullable(),
  ready_in_minutes: z.number().nullable(),
  conditions: z.string().nullable(),
  contact_person: z.string().nullable(),
  decline_reason: z.string().nullable(),
  alternate_number: z.string().nullable(),
  callback_due_at: isoOrNull,
  transcript: z.string().nullable(),
  recording_url: z.string().nullable(),
  answered_at: isoOrNull,
  outcome_at: isoOrNull,
  ended_at: isoOrNull,
  facility_name: z.string().nullable(),
  facility_lat: z.number().nullable(),
  facility_lng: z.number().nullable(),
  contact_role: z.string().nullable(),
  contact_is_ivr: z.boolean().nullable(),
});

const EventRow = z.object({
  id: z.number(),
  attempt_id: z.string().nullable(),
  type: z.string(),
  payload: z.record(z.unknown()),
  created_at: iso,
});

const Alert = z.object({
  event_id: z.number(),
  type: z.enum(['doctor_callback_requested', 'inbound_callback', 'alert']),
  attempt_id: z.string().nullable(),
  facility_name: z.string().nullable(),
  number: z.string().nullable(),
  reason: z.string().nullable(),
  contact_person: z.string().nullable(),
  kind: z.string().nullable(),
  created_at: iso,
});

const Message = z.object({
  audience: z.string(),
  to_masked: z.string(),
  status: z.enum(['sent', 'simulated', 'failed']),
  preview_redacted: z.string(),
  created_at: iso,
});

/** GET /api/referrals/:id */
export const ReferralViewSchema = z.object({
  referral: Referral,
  case_label: z.string(),
  needs: z.array(z.object({ code: z.string(), label: z.string() })),
  referrer: z.object({ name: z.string(), facility_name: z.string().nullable() }),
  origin: z.object({ lat: z.number(), lng: z.number(), name: z.string().nullable() }),
  attempts: z.array(Attempt),
  events: z.array(EventRow),
  messages: z.array(Message),
  alerts: z.array(Alert),
  portal_flags: z.record(z.object({ detail: z.string(), source: z.string(), observed_at: iso })),
  nearest_ed: z.array(
    z.object({ facility_id: z.string(), name: z.string(), kind: z.string(), distance_km: z.number(), eta_minutes: z.number(), phone: z.string() }),
  ),
  // Only when no hospital accepted: the numbers an admin listed beyond 108 and 112. Optional so an older server still parses.
  escalation: z.array(z.object({ label: z.string(), phone: z.string() })).default([]),
  tick_interval_ms: z.number(),
  server_time: iso,
});

export type Referral = z.infer<typeof Referral>;
export type AttemptView = z.infer<typeof Attempt>;
export type EventRow = z.infer<typeof EventRow>;
export type Alert = z.infer<typeof Alert>;
export type ReferralView = z.infer<typeof ReferralViewSchema>;

/** GET /api/referrals */
export const ReferralListSchema = z.object({
  referrals: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      status: z.enum(REFERRAL_STATUSES),
      case_label: z.string(),
      acuity: z.enum(ACUITIES),
      created_at: iso,
      ttfa_seconds: z.number().nullable(),
      time_to_confirmed_seconds: z.number().nullable(),
      calls_total: z.number(),
      close_reason: z.string().nullable(),
    }),
  ),
});
export type ReferralListItem = z.infer<typeof ReferralListSchema>['referrals'][number];

/** GET /api/mobile/config */
export const ConfigSchema = z.object({ auth_mode: z.enum(['passcode', 'users']) });

/** POST /api/login (with x-haazir-client: mobile) */
export const LoginSchema = z.object({ ok: z.literal(true), token: z.string().nullable() });

const Capability = z.object({ code: z.string(), label: z.string(), spoken_en: z.string(), category: z.string() });
const CaseTemplate = z.object({
  case_type: z.string(),
  label: z.string(),
  spoken_en: z.string(),
  default_capabilities: z.array(z.string()),
  clinician_reviewed: z.boolean(),
});
export type Capability = z.infer<typeof Capability>;
export type CaseTemplate = z.infer<typeof CaseTemplate>;

export const ROLES = ['admin', 'doctor', 'coordinator'] as const;
export type Role = (typeof ROLES)[number];

const Referrer = z.object({ id: z.string(), name: z.string(), facility: z.string().nullable() });
export type Referrer = z.infer<typeof Referrer>;

/** GET /api/mobile/bootstrap */
export const BootstrapSchema = z.object({
  user: z.object({ name: z.string().nullable(), email: z.string().nullable(), role: z.enum(ROLES) }),
  referrer: Referrer.nullable(),
  // The doctors an admin or coordinator may refer for. Defaults to none so an older server still parses.
  referrers: z.array(Referrer).default([]),
  templates: z.array(CaseTemplate),
  capabilities: z.array(Capability),
  bolna_ready: z.boolean(),
});
export type Bootstrap = z.infer<typeof BootstrapSchema>;

const Eligible = z.object({
  facility_id: z.string(),
  name: z.string(),
  distance_km: z.number(),
  eta_minutes: z.number(),
  call_language: z.string(),
  rank_reasons: z.array(z.string()),
  will_call: z.boolean(),
});

/** POST /api/referrals/preview */
export const PreviewSchema = z.object({
  spoken_summary: z.string().nullable(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()).optional(),
  eligible: z.array(Eligible),
  suggestions: z.array(z.string()),
  wave_size: z.number().optional(),
  skipped_far: z.number().optional(),
  max_eta_minutes: z.number().nullable().optional(),
});
export type Preview = z.infer<typeof PreviewSchema>;
export type Eligible = z.infer<typeof Eligible>;

/** POST /api/referrals */
export const CreatedSchema = z.object({ id: z.string(), code: z.string(), status: z.enum(REFERRAL_STATUSES) });

const Contact = z.object({
  id: z.string(),
  role: z.string(),
  phone_e164: z.string(),
  priority: z.number(),
  is_ivr: z.boolean(),
  active: z.boolean(),
});
const Facility = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  ownership: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  call_language: z.string(),
  active: z.boolean(),
  capabilities: z.array(z.string()),
  contacts: z.array(Contact),
  availability_calls: z.number(),
  answered: z.number(),
  accepted: z.number(),
  last_called_at: z.string().nullable(),
});
export type FacilityListItem = z.infer<typeof Facility>;

/** GET /api/facilities */
export const FacilityListSchema = z.object({ facilities: z.array(Facility) });

const Parsed = z.object({
  case_type: z.string().nullable(),
  required_capabilities: z.array(z.string()),
  acuity: z.enum(ACUITIES).nullable(),
  age_value: z.number().nullable(),
  age_unit: z.enum(['days', 'months', 'years']),
  sex: z.enum(['male', 'female', 'other', 'unknown']),
  note: z.string().nullable(),
  note_dropped: z.boolean(),
  matched: z.array(z.string()),
});
const Draft = z.object({ id: z.string(), kind: z.enum(['text', 'voice']), created_at: z.string(), parsed: Parsed });
export type Draft = z.infer<typeof Draft>;

/** GET /api/intake-drafts: referrals a doctor sent by WhatsApp, waiting to be reviewed. */
export const DraftsSchema = z.object({ drafts: z.array(Draft) });

/** GET /api/facilities/ratings: Google star ratings by hospital id (empty unless the server has a Places key). */
export const RatingsSchema = z.object({
  enabled: z.boolean(),
  ratings: z.record(z.object({ rating: z.number(), count: z.number(), url: z.string().nullable() })),
});
export type Rating = z.infer<typeof RatingsSchema>['ratings'][string];
