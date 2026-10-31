import type { Acuity, AgeUnit, Attempt, Capability, CaseTemplate, Contact, Facility, Referral, Referrer, Sex } from "@/lib/core/types";
import type { MatchParams } from "@/lib/modules/facility/facility.type";
import type { RankedFacility } from "@/lib/modules/facility/matching.helper";
import type { DialTarget, RedialReason } from "@/lib/modules/call/call.type";

/** What the "Find a bed" form sends. */
export interface ReferralInput {
  referrer_id: string;
  case_type: string;
  required_capabilities: string[];
  acuity: Acuity;
  age_value?: number | null;
  age_unit?: AgeUnit;
  sex?: Sex;
  note?: string | null;
  transport?: "ambulance" | "private_vehicle" | "unknown";
  search_radius_km?: number;
  origin_lat?: number;
  origin_lng?: number;
  /** Same id = same press of "Find a bed"; a double-click or retry returns the first referral instead of calling twice. */
  client_request_id?: string;
  patient?: {
    patient_name?: string | null;
    attendant_name?: string | null;
    attendant_phone?: string | null;
    attendant_language?: string | null;
    /** The doctor confirms the attendant agreed to their details being shared and to a WhatsApp update. */
    attendant_consent?: boolean;
  };
}

/** Everything a call or message about a referral needs, loaded once. */
export interface ReferralCtx {
  referral: Referral;
  referrer: Referrer;
  origin: Facility | null;
  template: CaseTemplate;
  needs: Capability[];
}

/** A checked input, its spoken summary and the ranked hospitals, before anything is written. */
export interface PreparedReferral {
  referrer: Referrer;
  origin: Facility | null;
  template: CaseTemplate;
  needs: Capability[];
  params: MatchParams;
  spoken_summary: string;
  warnings: string[];
  ranked: RankedFacility[];
  skipped_far: number;
}

/** The columns a new referral is inserted with. */
export interface NewReferral {
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
  is_simulated: boolean;
  is_demo: boolean;
  client_request_id: string | null;
}

/** The server-only identifiers (`patient_details`). */
export interface PatientDetails {
  patient_name: string | null;
  attendant_name: string | null;
  attendant_phone_e164: string | null;
  attendant_language: string;
  /** When the doctor recorded the attendant's agreement; null means the family must not be contacted. */
  attendant_consent_at: Date | null;
}

/** An outcome the doctor records after talking to the desk themselves. */
export interface ManualOutcome {
  outcome: Attempt["outcome"] & string;
  bed_type?: string | null;
  ready_in_minutes?: number | null;
  contact_person?: string | null;
  conditions?: string | null;
  decline_reason?: string | null;
}

/** What the referral, its calls and its hospitals' numbers look like when evaluation starts. */
export interface EvaluationSnapshot {
  referral: Referral;
  attempts: Attempt[];
  contacts: Map<string, Contact[]>;
}

/**
 * One thing evaluation should do, in order (docs/02-architecture.md §6.3). Each step is guarded when applied
 * (compare-and-set or a unique index), so applying a plan twice does nothing the second time.
 */
export type EvaluationStep =
  | { kind: "release"; attempt: Attempt }
  | { kind: "dispatch_hold"; hold: Attempt }
  | { kind: "first_acceptance"; attempt: Attempt }
  | { kind: "options_ready" }
  | { kind: "back_to_searching" }
  | { kind: "redial"; attempt: Attempt; target: DialTarget; reason: RedialReason }
  | { kind: "next_wave"; expectedWave: number; exhaustIfEmpty: boolean }
  | { kind: "exhaust" }
  | { kind: "hold_expired" };
