import { z } from "zod";

/** POST /api/escalation-contacts */
export const EscalationCreateBody = z.object({
  label: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(32),
  sort_order: z.number().int().min(1).max(99).default(1),
});
