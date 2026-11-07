import type { Acuity, Attempt, EventRow, Referral, ReferralStatus } from "@/lib/core/types";
import type { NearestEmergency } from "@/lib/modules/facility/facility.type";
import type { Audience } from "@/lib/modules/handoff/message.repository";

/** A call as the board shows it, with its hospital and number. */
export interface AttemptView extends Attempt {
  facility_name: string | null;
  facility_lat: number | null;
  facility_lng: number | null;
  contact_role: string | null;
  contact_is_ivr: boolean | null;
}

/** Something the doctor must act on: a desk asking for them, a hospital calling back, or a system alert. */
export interface Alert {
  event_id: number;
  type: "doctor_callback_requested" | "inbound_callback" | "alert";
  attempt_id: string | null;
  facility_name: string | null;
  number: string | null;
  reason: string | null;
  contact_person: string | null;
  kind: string | null;
  created_at: string;
}

/** A WhatsApp message as the board shows it: masked number and redacted preview only. */
export interface MessageView {
  audience: Audience;
  to_masked: string;
  status: "sent" | "simulated" | "failed";
  preview_redacted: string;
  created_at: string;
}

/** A desk answer contradicted by a fresh portal reading. */
export interface PortalFlag {
  detail: string;
  source: string;
  observed_at: string;
}

/**
 * What the console sees for one referral (GET /api/referrals/:id). Never patient details or message bodies
 * (CLAUDE.md rule 1): message previews come from redacted `handoff_sent` events.
 */
export interface ReferralView {
  referral: Referral;
  case_label: string;
  needs: Array<{ code: string; label: string }>;
  referrer: { name: string; facility_name: string | null };
  origin: { lat: number; lng: number; name: string | null };
  attempts: AttemptView[];
  events: EventRow[];
  messages: MessageView[];
  alerts: Alert[];
  portal_flags: Record<string, PortalFlag>;
  /**
   * When no hospital accepted, or the patient is critical and the search is running: the closest emergency departments to
   * stabilise at. Empty otherwise.
   */
  nearest_ed: NearestEmergency[];
  /** Only when no hospital accepted: the numbers an admin listed to call beyond 108 and 112. Empty otherwise. */
  escalation: Array<{ label: string; phone: string }>;
  tick_interval_ms: number;
  server_time: string;
}

/** One live referral on the coordinator's queue, with how its calls stand. No patient identifiers. */
export interface QueueItem {
  id: string;
  code: string;
  status: ReferralStatus;
  case_label: string;
  acuity: Acuity;
  created_at: string;
  referrer_name: string;
  /** The console user who keyed it in, when that is not the referring doctor themselves; null otherwise. */
  entered_by_name: string | null;
  calls_open: number;
  calls_answered: number;
  calls_accepted: number;
  /** Desks that asked to talk to the doctor / answers the doctor must check against the recording. */
  needs_doctor: number;
  needs_review: number;
  ttfa_seconds: number | null;
}

/** One row of the Referrals list. */
export interface ReferralListItem {
  id: string;
  code: string;
  status: ReferralStatus;
  case_label: string;
  acuity: Acuity;
  created_at: string;
  ttfa_seconds: number | null;
  time_to_confirmed_seconds: number | null;
  calls_total: number;
  close_reason: string | null;
}
