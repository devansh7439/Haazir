import { z } from "zod";
import { HOSPITAL_FULL_MAX_HOURS } from "@/lib/core/config";

/** POST /api/hospital/[token]/full: mark the hospital full for some hours, or clear it. */
export const FullBody = z.object({
  full: z.boolean(),
  hours: z.number().int().min(1).max(HOSPITAL_FULL_MAX_HOURS).optional(),
});

/** POST /api/hospital/[token]/withdraw: "we can no longer take this patient". */
export const WithdrawBody = z.object({ code: z.string().trim().min(3).max(32) });
