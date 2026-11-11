// Row shapes shared by server modules and the console. Mirrors supabase/migrations/0001_init.sql.

/**
 * What a console user may do: an admin runs the organisation, a doctor refers as themselves, a coordinator refers for any
 * doctor of the organisation.
 */
export const ROLES = ["admin", "doctor", "coordinator"] as const;
export type Role = (typeof ROLES)[number];

export type ReferralStatus =
  | "draft" | "searching" | "options_ready" | "confirming" | "confirmed" | "exhausted" | "cancelled" | "closed";

export type AttemptStatus =
  | "queued" | "dialing" | "ringing" | "in_progress" | "wrapping_up"
  | "completed" | "no_answer" | "busy" | "failed" | "canceled";

export type Purpose = "availability" | "hold_confirm" | "release" | "family_update" | "arrival_check";

/** Every execution status Bolna documents (CLAUDE.md, "Bolna essentials"). */
export const BOLNA_STATUSES = [
  "queued", "scheduled", "rescheduled", "initiated", "ringing", "in-progress", "call-disconnected", "completed",
  "no-answer", "busy", "failed", "canceled", "stopped", "error", "balance-low",
] as const;
export type BolnaStatus = (typeof BOLNA_STATUSES)[number];

/** What `call_attempts.bolna_status` holds: Bolna's own status, or the marker Haazir writes while it is placing or bridging a call. */
export type AttemptBolnaStatus = BolnaStatus | "dispatching" | "in_call";

/** What a hospital can answer on an availability call. */
export const AVAILABILITY_OUTCOMES = [
  "accepted", "conditional", "declined", "redirected", "needs_doctor", "callback_later", "ivr_blocked", "unclear",
] as const;
export type AvailabilityOutcome = (typeof AVAILABILITY_OUTCOMES)[number];
export type Outcome =
  | AvailabilityOutcome
  | "hold_confirmed" | "hold_declined" | "release_ack" | "family_informed" | "arrival_confirmed" | "not_arrived";

/** The kinds of bed a hospital can offer. */
export const BED_TYPES = ["icu_with_ventilator", "icu", "hdu", "nicu", "emergency_only", "ward", "none", "unknown"] as const;
export type BedType = (typeof BED_TYPES)[number];

/** How the patient travels. */
export const TRANSPORTS = ["ambulance", "private_vehicle", "unknown"] as const;
export type Transport = (typeof TRANSPORTS)[number];

/** Every type `EventRepository` writes to `events`, so a misspelt one fails to compile. */
export type EventType =
  | "referral_created" | "referral_cancelled" | "referral_closed" | "referral_exhausted" | "options_ready" | "wave_dispatched"
  | "call_queued" | "call_ringing" | "call_answered" | "call_ended" | "status_recovered" | "outcome_recorded" | "needs_review"
  | "redial_dispatched" | "release_dispatched" | "callback_scheduled" | "doctor_callback_requested" | "inbound_callback"
  | "facility_selected" | "hold_call_waiting" | "hold_confirmed" | "hold_declined" | "hold_expired"
  | "arrival_check_dispatched" | "arrival_confirmed" | "not_arrived" | "family_call_dispatched"
  | "alert" | "alert_dismissed" | "portal_mismatch" | "ambulance_status" | "treatment_started" | "transfer_consent_recorded"
  | "attachment_added" | "attachment_removed" | "handoff_sent" | "bed_request_sent";

export type Acuity = "critical" | "serious" | "stable";
export type Sex = "male" | "female" | "other" | "unknown";
export type AgeUnit = "days" | "months" | "years";

export type Airway = "intubated" | "own" | "unknown";
export type Payer = "free_govt" | "pmjay" | "insurance" | "cash" | "unknown";

/** What a receiving doctor asks first. None of it identifies the patient (CLAUDE.md rule 1). */
export interface ClinicalFacts {
  airway: Airway;
  spo2: number | null;
  gcs: number | null;
  on_oxygen: boolean | null;
  payer: Payer;
  medico_legal: boolean | null;
}

/** How a trauma patient was hurt. */
export const TRAUMA_MECHANISMS = ["not_trauma", "road_accident", "fall", "assault", "burn", "penetrating", "other", "unknown"] as const;
export type TraumaMechanism = (typeof TRAUMA_MECHANISMS)[number];
/** The infection precautions a receiving desk needs to know. */
export const INFECTIOUS_RISKS = ["none", "airborne", "contact", "bloodborne", "unknown"] as const;
export type InfectiousRisk = (typeof INFECTIOUS_RISKS)[number];
/** ABO and Rh blood groups, or unknown. */
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** What a receiving doctor asks after the vitals. None of it identifies the patient (CLAUDE.md rule 1). */
export interface HandoverFacts {
  pregnancy_weeks: number | null;
  trauma_mechanism: TraumaMechanism;
  infectious_risk: InfectiousRisk;
  treatment_given: string | null;
  blood_group: BloodGroup;
  blood_needed: boolean | null;
}

/** The handover facts of a referral where the doctor gave none. */
export const NO_HANDOVER_FACTS: HandoverFacts = {
  pregnancy_weeks: null,
  trauma_mechanism: "unknown",
  infectious_risk: "unknown",
  treatment_given: null,
  blood_group: "unknown",
  blood_needed: null,
};

/** Who agreed to the transfer. */
export const TRANSFER_CONSENTS = ["patient", "attendant", "emergency_waiver"] as const;
export type TransferConsent = (typeof TRANSFER_CONSENTS)[number];
/** Why the patient is being referred. */
export const TRANSFER_REASONS = ["service_not_available", "needs_higher_care", "no_bed", "other"] as const;
export type TransferReason = (typeof TRANSFER_REASONS)[number];

/** Consent to the transfer itself, kept on the referral so the slip can show it (migration 0015). */
export interface TransferRecord {
  transfer_consent: TransferConsent | null;
  transfer_consent_at: Date | string | null;
  transfer_reason: TransferReason | null;
}

/** Where the ambulance stands, as the doctor records it. */
export const AMBULANCE_STATUSES = ["not_requested", "requested", "dispatched", "at_patient", "not_available"] as const;
export type AmbulanceStatus = (typeof AMBULANCE_STATUSES)[number];

/** Where the ambulance is, as the doctor last recorded it (migration 0017). Haazir does not book it. */
export interface AmbulanceRecord {
  ambulance_status: AmbulanceStatus;
  ambulance_updated_at: Date | string | null;
}

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
  /** The Google place this hospital is matched to, for its star rating; null until matched. */
  google_place_id: string | null;
}

export interface Contact {
  id: string;
  /** Inherited from the hospital by trigger (migration 0003). */
  org_id: string;
  facility_id: string;
  role: string;
  phone_e164: string;
  priority: number;
  is_ivr: boolean;
  verified_at: string | null;
  calls_made: number;
  calls_answered: number;
  last_outcome: Outcome | null;
  active: boolean;
}

export interface Referral extends ClinicalFacts, HandoverFacts, TransferRecord, AmbulanceRecord {
  id: string;
  org_id: string;
  code: string;
  status: ReferralStatus;
  referrer_id: string;
  /** The console user who keyed the referral in, which differs from the referrer when a coordinator placed it (migration 0021). */
  entered_by: string | null;
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
  transport: Transport;
  search_radius_km: number;
  /** Hospitals that said no on the search this one widened; they are not called again (migration 0024). */
  declined_facility_ids: string[];
  current_wave: number;
  wave_started_at: Date | string | null;
  selected_facility_id: string | null;
  selected_attempt_id: string | null;
  hold_expires_at: Date | string | null;
  first_acceptance_at: Date | string | null;
  confirmed_at: Date | string | null;
  closed_at: Date | string | null;
  close_reason: string | null;
  /** When the receiving hospital began treating the patient, as recorded by the doctor; null until then (migration 0018). */
  treatment_started_at: Date | string | null;
  is_demo: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Attempt {
  id: string;
  /** Inherited from the referral by trigger (migration 0003). */
  org_id: string;
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
  bolna_status: AttemptBolnaStatus | null;
  termination_reason: string | null;
  outcome: Outcome | null;
  outcome_source: "function" | "extraction" | "manual" | "whatsapp" | null;
  extraction_outcome: AvailabilityOutcome | null;
  needs_review: boolean;
  bed_type: BedType | null;
  specialist_available: string | null;
  ready_in_minutes: number | null;
  conditions: string | null;
  contact_person: string | null;
  decline_reason: string | null;
  alternate_number: string | null;
  callback_due_at: Date | string | null;
  transcript: string | null;
  recording_url: string | null;
  /** What Bolna charged for the call, in its own units, and the conversation length; set at `completed`. */
  cost: number | null;
  duration_s: number | null;
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
  /** Rows written before a type was added may hold one that `EventType` lacks, so reading code treats it as text. */
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

/** Where a doctor's medical registration stands. */
export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export interface Referrer {
  id: string;
  org_id: string;
  name: string;
  phone_e164: string;
  facility_id: string | null;
  languages: string[];
  /** Medical registration number and the council that issued it (NMC or a state council); null until the doctor gives them. */
  registration_no: string | null;
  registration_council: string | null;
  verification_status: VerificationStatus;
  verified_at: Date | string | null;
  verified_by: string | null;
}

/** The organisation that demo and passcode sessions belong to. */
export const DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";
