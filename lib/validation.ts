import { z } from "zod";
import { AVAILABILITY_OUTCOMES, BED_TYPES } from "./types";

// Request bodies for console routes. Bolna payloads are normalised separately (lib/normalize.ts):
// every value arrives as a string and may be "None" or an unreplaced %(name)s token.

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

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
  patient: z
    .object({
      patient_name: optionalText(120),
      attendant_name: optionalText(120),
      attendant_phone: optionalText(32),
      attendant_language: z.string().regex(/^[a-z]{2}$/).optional().nullable(),
    })
    .optional(),
});
export type ReferralBodyT = z.infer<typeof ReferralBody>;

export const PreviewBody = ReferralBody.omit({ patient: true, simulate: true, draft_id: true });

export const SelectBody = z.object({ attempt_id: z.string().uuid(), force: z.boolean().default(false) });

export const ConfirmManuallyBody = z.object({ attempt_id: z.string().uuid(), contact_person: optionalText(120) });

export const CancelBody = z.object({ reason: optionalText(160) });

export const CloseBody = z.object({
  reason: z.enum(["arrived", "hold_expired", "transferred_elsewhere", "other"]),
  note: optionalText(160),
});

export const DismissAlertBody = z.object({ event_id: z.number().int().positive() });

export const ManualOutcomeBody = z.object({
  outcome: z.enum(AVAILABILITY_OUTCOMES),
  bed_type: z.enum(BED_TYPES).optional().nullable().or(z.literal("").transform(() => null)),
  ready_in_minutes: z.number().int().min(0).max(600).optional().nullable(),
  contact_person: optionalText(120),
  conditions: optionalText(200),
  decline_reason: optionalText(200),
});

export const RedialBody = z
  .object({ contact_id: z.string().uuid().optional(), to_number: z.string().max(32).optional() })
  .refine((b) => !!b.contact_id || !!b.to_number, { message: "contact_id or to_number is required" });

// ---------------------------------------------------------------- directory

const phone = z.string().trim().min(6).max(32);
const lang = z.string().regex(/^[a-z]{2}$/);

export const FacilityCreateBody = z.object({
  name: z.string().trim().min(2).max(160),
  kind: z.enum(["phc", "chc", "district_hospital", "medical_college", "private_hospital", "nursing_home", "other"]),
  ownership: z.enum(["public", "private", "trust", "unknown"]).default("unknown"),
  address: optionalText(240),
  city: optionalText(80),
  district: optionalText(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  call_language: lang.default("en"),
  whatsapp_number: optionalText(32),
});

export const FacilityPatchBody = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  address: optionalText(240),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  call_language: lang.optional(),
  whatsapp_number: z.string().trim().max(32).optional().nullable(),
  active: z.boolean().optional(),
  notes: optionalText(400),
});

export const CapabilitiesBody = z.object({ codes: z.array(z.string().min(1).max(64)).max(40) });

export const ContactCreateBody = z.object({
  role: z.enum(["casualty_desk", "referral_desk", "nursing_station", "duty_manager", "reception", "other"]),
  phone,
  priority: z.number().int().min(1).max(99).default(1),
  is_ivr: z.boolean().default(false),
});

export const ContactPatchBody = z.object({
  role: z.enum(["casualty_desk", "referral_desk", "nursing_station", "duty_manager", "reception", "other"]).optional(),
  phone: phone.optional(),
  priority: z.number().int().min(1).max(99).optional(),
  is_ivr: z.boolean().optional(),
  active: z.boolean().optional(),
  verified: z.boolean().optional(),
});

// ---------------------------------------------------------------- demo

export const AssignNumbersBody = z.object({
  assignments: z
    .array(z.object({ facility_id: z.string().uuid(), phone: optionalText(32), whatsapp: optionalText(32) }))
    .max(20)
    .default([]),
  referrer_phone: optionalText(32),
  family_phone: optionalText(32),
});

export const TestCallBody = z.object({ facility_id: z.string().uuid(), consented_test: z.boolean().default(false) });

export const DemoRunBody = z.object({ simulate: z.boolean().default(true) });

export const LoginBody = z.union([
  z.object({ passcode: z.string().max(200) }),
  z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) }),
]);
