import { z } from "zod";
import { AMBULANCE_STATUSES, BLOOD_GROUPS, INFECTIOUS_RISKS, TRANSFER_CONSENTS, TRANSFER_REASONS, TRAUMA_MECHANISMS } from "@/lib/core/types";
import { languageCode, optionalText } from "@/lib/core/validation";

/** POST /api/referrals: the "Find a bed" form. */
export const ReferralBody = z.object({
  referrer_id: z.string().uuid(),
  case_type: z.string().min(1).max(64),
  required_capabilities: z.array(z.string().min(1).max(64)).max(12),
  acuity: z.enum(["critical", "serious", "stable"]),
  age_value: z.number().int().min(0).max(120).optional().nullable(),
  age_unit: z.enum(["days", "months", "years"]).default("years"),
  sex: z.enum(["male", "female", "other", "unknown"]).default("unknown"),
  note: z.string().max(160).optional().nullable(),
  airway: z.enum(["intubated", "own", "unknown"]).default("unknown"),
  spo2: z.number().int().min(0).max(100).optional().nullable(),
  gcs: z.number().int().min(3).max(15).optional().nullable(),
  on_oxygen: z.boolean().optional().nullable(),
  payer: z.enum(["free_govt", "pmjay", "insurance", "cash", "unknown"]).default("unknown"),
  medico_legal: z.boolean().optional().nullable(),
  pregnancy_weeks: z.number().int().min(1).max(45).optional().nullable(),
  trauma_mechanism: z.enum(TRAUMA_MECHANISMS).default("unknown"),
  infectious_risk: z.enum(INFECTIOUS_RISKS).default("unknown"),
  treatment_given: z.string().max(160).optional().nullable(),
  blood_group: z.enum(BLOOD_GROUPS).default("unknown"),
  blood_needed: z.boolean().optional().nullable(),
  transfer_consent: z.enum(TRANSFER_CONSENTS).optional().nullable(),
  transfer_reason: z.enum(TRANSFER_REASONS).optional().nullable(),
  transport: z.enum(["ambulance", "private_vehicle", "unknown"]).default("ambulance"),
  search_radius_km: z.number().int().min(1).max(300).default(40),
  origin_lat: z.number().min(-90).max(90).optional(),
  origin_lng: z.number().min(-180).max(180).optional(),
  draft_id: z.string().uuid().optional(),
  client_request_id: z.string().uuid().optional(),
  patient: z
    .object({
      patient_name: optionalText(120),
      attendant_name: optionalText(120),
      attendant_phone: optionalText(32),
      attendant_language: languageCode.optional().nullable(),
      attendant_consent: z.boolean().optional(),
    })
    .optional(),
});
export type ReferralBodyT = z.infer<typeof ReferralBody>;

/** POST /api/referrals/preview: the same form, without identifiers or side effects. */
export const PreviewBody = ReferralBody.omit({ patient: true, draft_id: true, client_request_id: true });

/** POST /api/referrals/[id]/transfer-consent: records, or corrects, who agreed to the transfer. */
export const TransferConsentBody = z.object({
  transfer_consent: z.enum(TRANSFER_CONSENTS),
  transfer_reason: z.enum(TRANSFER_REASONS).optional().nullable(),
});

/** POST /api/referrals/[id]/ambulance: where the ambulance is, as the doctor records it. */
export const AmbulanceBody = z.object({ status: z.enum(AMBULANCE_STATUSES) });

export const SelectBody = z.object({ attempt_id: z.string().uuid(), force: z.boolean().default(false) });

export const ConfirmManuallyBody = z.object({ attempt_id: z.string().uuid(), contact_person: optionalText(120) });

export const CancelBody = z.object({ reason: optionalText(160) });

export const CloseBody = z.object({
  reason: z.enum(["arrived", "hold_expired", "transferred_elsewhere", "other"]),
  note: optionalText(160),
});

export const DismissAlertBody = z.object({ event_id: z.number().int().positive() });
