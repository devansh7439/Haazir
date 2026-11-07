// The referral slip (transfer record): who sent the patient, where, why, who consented and the SBAR handover. Pure.
// It holds no patient name or phone (CLAUDE.md rule 1); the hospital's own file carries those.

import type { Referral, Referrer, TransferConsent, TransferReason } from "@/lib/core/types";
import { type Sbar, buildSbar, sbarLines } from "@/lib/modules/referral/sbar.helper";

export interface SlipInput {
  referral: Referral;
  referrer: Referrer;
  origin_name: string | null;
  case_label: string;
  needs_labels: string[];
  hospital_name: string;
  hospital_address: string | null;
  desk_number: string;
  contact_person: string | null;
  bed_type: string | null;
  eta_minutes: number | null;
}

export interface Slip {
  code: string;
  confirmed_at: Date | string | null;
  hold_until: Date | string | null;
  from: { doctor: string; facility: string | null; registration: string | null; verification: Referrer["verification_status"] };
  to: { hospital: string; address: string | null; desk_number: string; contact_person: string | null; bed_type: string | null };
  reason: string;
  ambulance: Referral["ambulance_status"];
  consent: { by: string; at: Date | string } | null;
  sbar: Sbar;
  /** The same slip as plain lines, for printing or pasting into a message. */
  lines: string[];
}

const CONSENT_LABEL: Record<TransferConsent, string> = {
  patient: "the patient",
  attendant: "the attendant",
  emergency_waiver: "no one: emergency transfer, patient unable to consent and no attendant present",
};
const REASON_LABEL: Record<TransferReason, string> = {
  service_not_available: "Service not available at the referring centre",
  needs_higher_care: "Needs a higher level of care",
  no_bed: "No bed at the referring centre",
  other: "Other",
};
const AMBULANCE_LABEL: Record<Referral["ambulance_status"], string> = {
  not_requested: "not recorded",
  requested: "requested (108 or hospital)",
  dispatched: "dispatched",
  at_patient: "with the patient",
  not_available: "none available, other transport",
};
const VERIFICATION_LABEL: Record<Referrer["verification_status"], string> = {
  verified: "registration verified",
  pending: "registration not yet verified",
  unverified: "registration not given",
  rejected: "registration could not be verified",
};

/** The slip for a confirmed referral, built only from its fields. */
export function buildSlip(i: SlipInput): Slip {
  const r = i.referral;
  const registration = i.referrer.registration_no
    ? `${i.referrer.registration_council ?? "Council not given"} ${i.referrer.registration_no}`
    : null;
  const consent = r.transfer_consent && r.transfer_consent_at ? { by: CONSENT_LABEL[r.transfer_consent], at: r.transfer_consent_at } : null;
  const reason = r.transfer_reason ? REASON_LABEL[r.transfer_reason] : "Not recorded";
  const sbar = buildSbar(r, { case_label: i.case_label, needs_labels: i.needs_labels, eta_minutes: i.eta_minutes });
  const lines = [
    `Referral slip ${r.code}`,
    `From: ${i.referrer.name}${i.origin_name ? `, ${i.origin_name}` : ""} ` +
      `(${registration ?? "registration not given"}; ${VERIFICATION_LABEL[i.referrer.verification_status]})`,
    `To: ${i.hospital_name}${i.hospital_address ? `, ${i.hospital_address}` : ""} · ` +
      `desk ${i.desk_number}${i.contact_person ? ` · ${i.contact_person}` : ""}`,
    `Reason for transfer: ${reason}`,
    `Consent to transfer: ${consent ? `given by ${consent.by}` : "not recorded"}`,
    `Ambulance: ${AMBULANCE_LABEL[r.ambulance_status]}`,
    ...sbarLines(sbar),
  ];
  return {
    code: r.code,
    confirmed_at: r.confirmed_at,
    hold_until: r.hold_expires_at,
    from: { doctor: i.referrer.name, facility: i.origin_name, registration, verification: i.referrer.verification_status },
    to: {
      hospital: i.hospital_name,
      address: i.hospital_address,
      desk_number: i.desk_number,
      contact_person: i.contact_person,
      bed_type: i.bed_type,
    },
    reason,
    ambulance: r.ambulance_status,
    consent,
    sbar,
    lines,
  };
}
