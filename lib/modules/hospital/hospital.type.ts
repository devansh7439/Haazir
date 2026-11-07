/** Where a referral stands for the hospital that was asked. */
export type DeskState = "asking" | "said_yes" | "chosen" | "held" | "released" | "said_no" | "other";

/** One referral as the hospital's desk screen shows it: the case as read on the call, never a patient identifier. */
export interface DeskReferral {
  code: string;
  summary: string;
  doctor: string | null;
  referring_facility: string | null;
  eta_minutes: number | null;
  asked_at: string;
  state: DeskState;
  /** Only while the bed is held. */
  hold_until: string | null;
  /** The hospital may tell the doctor it can no longer take this patient. */
  can_withdraw: boolean;
  /** When the hospital said treatment started; null until then. The button shows while the bed is held and this is null. */
  treatment_started_at: string | null;
}

/** What a hospital's private link shows. */
export interface DeskSnapshot {
  facility_name: string;
  /** Matching skips the hospital until then; null when it is taking referrals. */
  full_until: string | null;
  referrals: DeskReferral[];
  server_time: string;
}

/** A facility found by its link's token. */
export interface DeskFacility {
  facility_id: string;
  org_id: string;
  name: string;
  full_until: Date | null;
}

/** A call the hospital was asked, with its referral. */
export interface DeskCallRow {
  code: string;
  referral_status: string;
  selected_facility_id: string | null;
  hold_expires_at: Date | null;
  treatment_started_at: Date | null;
  summary: string;
  doctor_name: string | null;
  origin_name: string | null;
  outcome: string | null;
  status: string;
  eta_minutes: number | null;
  created_at: Date;
}
