import { z } from "zod";
import { languageCode, optionalText } from "@/lib/core/validation";

const phone = z.string().trim().min(6).max(32);
const CONTACT_ROLE = z.enum(["casualty_desk", "referral_desk", "nursing_station", "duty_manager", "reception", "other"]);

export const ContactCreateBody = z.object({
  role: CONTACT_ROLE,
  phone,
  priority: z.number().int().min(1).max(99).default(1),
  is_ivr: z.boolean().default(false),
});

/** POST /api/facilities: a hospital with the services it offers and its desk numbers, listed in one step. */
export const FacilityCreateBody = z.object({
  name: z.string().trim().min(2).max(160),
  kind: z.enum(["phc", "chc", "district_hospital", "medical_college", "private_hospital", "nursing_home", "other"]),
  ownership: z.enum(["public", "private", "trust", "unknown"]).default("unknown"),
  address: optionalText(240),
  city: optionalText(80),
  district: optionalText(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  call_language: languageCode.default("en"),
  whatsapp_number: optionalText(32),
  capabilities: z.array(z.string().min(1).max(64)).max(40).default([]),
  contacts: z.array(ContactCreateBody).max(5).default([]),
});

export const FacilityPatchBody = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  address: optionalText(240),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  call_language: languageCode.optional(),
  whatsapp_number: z.string().trim().max(32).optional().nullable(),
  active: z.boolean().optional(),
  notes: optionalText(400),
});

export const CapabilitiesBody = z.object({ codes: z.array(z.string().min(1).max(64)).max(40) });

export const ContactPatchBody = z.object({
  role: CONTACT_ROLE.optional(),
  phone: phone.optional(),
  priority: z.number().int().min(1).max(99).optional(),
  is_ivr: z.boolean().optional(),
  active: z.boolean().optional(),
  verified: z.boolean().optional(),
});
