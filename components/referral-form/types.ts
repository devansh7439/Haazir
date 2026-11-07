/** A hospital the preview would call. */
export interface Eligible {
  facility_id: string;
  name: string;
  distance_km: number;
  eta_minutes: number;
  call_language: string;
  rank_reasons: string[];
  will_call: boolean;
}

/** POST /api/referrals/preview's answer: what hospitals will hear and who would be called. */
export interface Preview {
  spoken_summary: string | null;
  warnings: string[];
  errors?: string[];
  eligible: Eligible[];
  suggestions: string[];
  wave_size?: number;
  skipped_far?: number;
  max_eta_minutes?: number | null;
}

export type Acuity = "critical" | "serious" | "stable";
export type Sex = "male" | "female" | "other" | "unknown";
export type AgeUnit = "years" | "months" | "days";

export type Tri = "yes" | "no" | "unknown";
export type Airway = "intubated" | "own" | "unknown";
export type Payer = "free_govt" | "pmjay" | "insurance" | "cash" | "unknown";

/** The bedside status and cover the form asks for, as typed (numbers stay strings until sent). */
export interface FactFields {
  airway: Airway;
  spo2: string;
  gcs: string;
  on_oxygen: Tri;
  payer: Payer;
  medico_legal: Tri;
}

export type Mechanism = "unknown" | "not_trauma" | "road_accident" | "fall" | "assault" | "burn" | "penetrating" | "other";
export type InfectiousRisk = "unknown" | "none" | "airborne" | "contact" | "bloodborne";
export type BloodGroup = "unknown" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type Consent = "none" | "patient" | "attendant" | "emergency_waiver";
export type Reason = "none" | "service_not_available" | "needs_higher_care" | "no_bed" | "other";

/** The handover the receiving doctor asks for after the vitals, as typed (weeks stay a string until sent). */
export interface HandoverFields {
  pregnancy_weeks: string;
  trauma_mechanism: Mechanism;
  infectious_risk: InfectiousRisk;
  treatment_given: string;
  blood_group: BloodGroup;
  blood_needed: Tri;
}

/** Who agreed to the transfer and why the patient is being sent. */
export interface TransferFields {
  consent: Consent;
  reason: Reason;
}

/** The private patient and family fields (never spoken on calls). */
export interface PatientFields {
  patient_name: string;
  attendant_name: string;
  attendant_phone: string;
  attendant_language: string;
  /** The attendant agreed to their details being shared and to a WhatsApp update. */
  attendant_consent: boolean;
}
