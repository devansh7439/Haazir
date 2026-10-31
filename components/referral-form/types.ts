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

/** The private patient and family fields (never spoken on calls). */
export interface PatientFields {
  patient_name: string;
  attendant_name: string;
  attendant_phone: string;
  attendant_language: string;
  /** The attendant agreed to their details being shared and to a WhatsApp update. */
  attendant_consent: boolean;
}
