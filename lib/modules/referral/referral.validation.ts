import { z } from "zod";
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
  transport: z.enum(["ambulance", "private_vehicle", "unknown"]).default("ambulance"),
  search_radius_km: z.number().int().min(1).max(300).default(40),
  origin_lat: z.number().min(-90).max(90).optional(),
  origin_lng: z.number().min(-180).max(180).optional(),
  simulate: z.boolean().optional(),
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
export const PreviewBody = ReferralBody.omit({ patient: true, simulate: true, draft_id: true, client_request_id: true });

export const SelectBody = z.object({ attempt_id: z.string().uuid(), force: z.boolean().default(false) });

export const ConfirmManuallyBody = z.object({ attempt_id: z.string().uuid(), contact_person: optionalText(120) });

export const CancelBody = z.object({ reason: optionalText(160) });

export const CloseBody = z.object({
  reason: z.enum(["arrived", "hold_expired", "transferred_elsewhere", "other"]),
  note: optionalText(160),
});

export const DismissAlertBody = z.object({ event_id: z.number().int().positive() });
