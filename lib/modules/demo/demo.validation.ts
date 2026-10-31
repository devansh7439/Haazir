import { z } from "zod";
import { optionalText } from "@/lib/core/validation";

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

/** PUT /api/test-matrix: one scenario's result in one pass. */
export const TestMatrixBody = z.object({
  pass: z.union([z.literal(1), z.literal(2)]),
  row_no: z.number().int().min(1).max(20),
  result: z.enum(["pass", "fail", "untested"]),
  note: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  referral_code: z.string().trim().max(12).optional().nullable().transform((v) => v || null),
  tested_by: z.string().trim().max(80).optional().nullable().transform((v) => v || null),
});
