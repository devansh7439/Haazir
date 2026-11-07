import { z } from "zod";

/** POST /api/login: the shared passcode, or an email and password (AUTH_MODE=users). */
export const LoginBody = z.union([
  z.object({ passcode: z.string().max(200) }),
  z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) }),
]);
export type LoginBodyT = z.infer<typeof LoginBody>;

/** POST /api/referrers/[id]/registration: the doctor's registration number and council. */
export const RegistrationBody = z.object({
  registration_no: z.string().trim().min(1).max(40),
  registration_council: z.string().trim().min(1).max(80),
});

/** POST /api/referrers/[id]/verification: an admin's decision after checking the register. */
export const VerificationBody = z.object({ decision: z.enum(["verified", "rejected"]) });
