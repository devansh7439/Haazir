// Row shapes shared by server modules and the console. Mirrors supabase/migrations/0001_init.sql.

export type ReferralStatus =
  | "draft" | "searching" | "options_ready" | "confirming" | "confirmed" | "exhausted" | "cancelled" | "closed";

export type AttemptStatus =
  | "queued" | "dialing" | "ringing" | "in_progress" | "wrapping_up"
  | "completed" | "no_answer" | "busy" | "failed" | "canceled";

export type Purpose = "availability" | "hold_confirm" | "release" | "family_update";

export const AVAILABILITY_OUTCOMES = [
  "accepted", "conditional", "declined", "redirected", "needs_doctor", "callback_later", "ivr_blocked", "unclear",
] as const;
export type AvailabilityOutcome = (typeof AVAILABILITY_OUTCOMES)[number];
export type Outcome = AvailabilityOutcome | "hold_confirmed" | "hold_declined" | "release_ack" | "family_informed";

export const BED_TYPES = ["icu_with_ventilator", "icu", "hdu", "nicu", "emergency_only", "ward", "none", "unknown"] as const;
export type BedType = (typeof BED_TYPES)[number];

export type Acuity = "critical" | "serious" | "stable";
export type Sex = "male" | "female" | "other" | "unknown";
export type AgeUnit = "days" | "months" | "years";

export interface Facility {
  id: string;
  org_id: string;
  name: string;
  kind: string;
  ownership: string;
  address: string | null;
  city: string | null;
  district: string | null;
  lat: number;
  lng: number;
  call_language: string;
  whatsapp_number: string | null;
  is_demo: boolean;
  active: boolean;
  notes: string | null;
}

export interface Contact {
  id: string;
  facility_id: string;
  role: string;
  phone_e164: string;
  priority: number;
  is_ivr: boolean;
  verified_at: string | null;
  calls_made: number;
  calls_answered: number;
  last_outcome: string | null;
  active: boolean;
}

export interface Referral {
  id: string;
  org_id: string;
  code: string;
  status: ReferralStatus;
  referrer_id: string;
  origin_facility_id: string | null;
  origin_lat: number;
  origin_lng: number;
  case_type: string;
  acuity: Acuity;
  age_value: number | null;
  age_unit: AgeUnit;
  sex: Sex;
  note: string | null;
  required_capabilities: string[];
  spoken_summary: string;
  transport: string;
  search_radius_km: number;
  current_wave: number;
  wave_started_at: Date | string | null;
  selected_facility_id: string | null;
  selected_attempt_id: string | null;
  hold_expires_at: Date | string | null;
  first_acceptance_at: Date | string | null;
  confirmed_at: Date | string | null;
  closed_at: Date | string | null;
  close_reason: string | null;
  is_simulated: boolean;
  is_demo: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Attempt {
  id: string;
  referral_id: string;
  facility_id: string | null;
  contact_id: string | null;
  parent_attempt_id: string | null;
  purpose: Purpose;
  wave: number;
  rank: number | null;
  distance_km: number | null;
  eta_minutes: number | null;
  rank_reasons: string[];
  to_number: string;
  call_language: string;
  bolna_agent_id: string | null;
  bolna_execution_id: string | null;
  status: AttemptStatus;
  bolna_status: string | null;
  termination_reason: string | null;
  outcome: Outcome | null;
  outcome_source: "function" | "extraction" | "manual" | "simulation" | "whatsapp" | null;
  extraction_outcome: string | null;
  needs_review: boolean;
  bed_type: string | null;
  specialist_available: string | null;
  ready_in_minutes: number | null;
  conditions: string | null;
  contact_person: string | null;
  decline_reason: string | null;
  alternate_number: string | null;
  callback_due_at: Date | string | null;
  transcript: string | null;
  recording_url: string | null;
  extracted_data: unknown;
  dispatched_at: Date | string | null;
  answered_at: Date | string | null;
  outcome_at: Date | string | null;
  ended_at: Date | string | null;
  last_polled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface EventRow {
  id: number;
  referral_id: string;
  attempt_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  created_at: Date | string;
}

export interface Capability {
  code: string;
  label: string;
  spoken_en: string;
  category: string;
}

export interface CaseTemplate {
  case_type: string;
  label: string;
  spoken_en: string;
  default_capabilities: string[];
  clinician_reviewed: boolean;
}

export interface Referrer {
  id: string;
  org_id: string;
  name: string;
  phone_e164: string;
  facility_id: string | null;
  languages: string[];
}

export const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";
