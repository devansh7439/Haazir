import { z } from "zod";
import { AVAILABILITY_OUTCOMES, BED_TYPES } from "@/lib/core/types";
import { optionalText } from "@/lib/core/validation";

/** POST /api/attempts/:id/manual-outcome: what the desk told the doctor by phone. */
export const ManualOutcomeBody = z.object({
  outcome: z.enum(AVAILABILITY_OUTCOMES),
  bed_type: z.enum(BED_TYPES).optional().nullable().or(z.literal("").transform(() => null)),
  ready_in_minutes: z.number().int().min(0).max(600).optional().nullable(),
  contact_person: optionalText(120),
  conditions: optionalText(200),
  decline_reason: optionalText(200),
});

/** POST /api/attempts/:id/redial: a directory number or a new one. */
export const RedialBody = z
  .object({ contact_id: z.string().uuid().optional(), to_number: z.string().max(32).optional() })
  .refine((b) => !!b.contact_id || !!b.to_number, { message: "contact_id or to_number is required" });
