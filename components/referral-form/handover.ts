import type { HandoverFields, Tri, TransferFields } from "./types";

export const NO_HANDOVER: HandoverFields = {
  pregnancy_weeks: "",
  trauma_mechanism: "unknown",
  infectious_risk: "unknown",
  treatment_given: "",
  blood_group: "unknown",
  blood_needed: "unknown",
};

export const NO_TRANSFER: TransferFields = { consent: "none", reason: "none" };

export const TREATMENT_MAX = 160;

const tri = (v: Tri): boolean | null => (v === "yes" ? true : v === "no" ? false : null);
const weeks = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Whether pregnancy weeks, if typed, is a week the server accepts (1–45); empty is fine. */
export const handoverValid = (h: HandoverFields): boolean => {
  const w = weeks(h.pregnancy_weeks);
  return w === null || (w >= 1 && w <= 45);
};

/** The handover as POST /api/referrals takes it; weeks out of range are left out rather than sent. */
export const handoverBody = (h: HandoverFields) => ({
  pregnancy_weeks: handoverValid(h) ? weeks(h.pregnancy_weeks) : null,
  trauma_mechanism: h.trauma_mechanism,
  infectious_risk: h.infectious_risk,
  treatment_given: h.treatment_given.trim() || null,
  blood_group: h.blood_group,
  blood_needed: tri(h.blood_needed),
});

/** The transfer consent and reason as POST /api/referrals takes them; "none" is sent as null. */
export const transferBody = (t: TransferFields) => ({
  transfer_consent: t.consent === "none" ? null : t.consent,
  transfer_reason: t.reason === "none" ? null : t.reason,
});
