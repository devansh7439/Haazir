import { NO_HANDOVER_FACTS, type Attempt, type Facility, type Referral, type Referrer } from "@/lib/core/types";

// Plain rows for tests that need no database. Override only what the case is about.

const AT = "2026-10-31T10:00:00Z";

/** A critical snakebite referral, still searching. */
export const referralRow = (o: Partial<Referral> = {}): Referral => ({
  id: "r1", org_id: "o1", code: "R-4821", status: "searching", referrer_id: "d1", entered_by: null, origin_facility_id: null,
  origin_lat: 13, origin_lng: 77, case_type: "snakebite_neuro", acuity: "critical", age_value: 34, age_unit: "years",
  sex: "male", note: null, airway: "own", spo2: 90, gcs: 15, on_oxygen: true, payer: "pmjay", medico_legal: false,
  ...NO_HANDOVER_FACTS, transfer_consent: null, transfer_consent_at: null, transfer_reason: null,
  ambulance_status: "not_requested", ambulance_updated_at: null, treatment_started_at: null,
  required_capabilities: ["icu", "ventilator"], spoken_summary: "Man aged 34, suspected snakebite, critical.", transport: "ambulance",
  search_radius_km: 40, current_wave: 1, wave_started_at: null, selected_facility_id: null, selected_attempt_id: null,
  hold_expires_at: null, first_acceptance_at: null, confirmed_at: null, closed_at: null, close_reason: null, is_demo: true,
  created_at: AT, updated_at: AT, ...o,
});

/** A verified referring doctor. */
export const referrerRow = (o: Partial<Referrer> = {}): Referrer => ({
  id: "d1", org_id: "o1", name: "Dr. Meera Rao (Demo)", phone_e164: "+919800000001", facility_id: null, languages: ["en"],
  registration_no: null, registration_council: null, verification_status: "verified", verified_at: null, verified_by: null, ...o,
});

/** A queued availability call to a Kannada-speaking desk. */
export const attemptRow = (o: Partial<Attempt> = {}): Attempt => ({
  id: "5b1f0c7e-1f7a-4c3e-9a51-0c9d1e2f3a4b", org_id: "o1", referral_id: "r1", facility_id: "f1", contact_id: "c1", parent_attempt_id: null,
  purpose: "availability", wave: 1, rank: 1, distance_km: 5, eta_minutes: 18, rank_reasons: [], to_number: "+911111111111", call_language: "kn",
  bolna_agent_id: null, bolna_execution_id: null, status: "queued", bolna_status: null, termination_reason: null, outcome: null,
  outcome_source: null, extraction_outcome: null, needs_review: false, bed_type: null, specialist_available: null, ready_in_minutes: null,
  conditions: null, contact_person: null, decline_reason: null, alternate_number: null, callback_due_at: null, transcript: null,
  recording_url: null, cost: null, duration_s: null, extracted_data: null, dispatched_at: null, answered_at: null, outcome_at: null,
  ended_at: null, last_polled_at: null, created_at: AT, updated_at: AT, ...o,
});

/** A district hospital with a WhatsApp number. */
export const facilityRow = (o: Partial<Facility> = {}): Facility => ({
  id: "f1", org_id: "o1", name: "Tamarind District Hospital (Demo)", kind: "district_hospital", ownership: "government",
  address: "12 Lake Road", city: "Bengaluru", district: "Bengaluru Urban", lat: 13, lng: 77, call_language: "kn",
  whatsapp_number: "+918000000000", is_demo: true, active: true, notes: null, google_place_id: null, ...o,
});
