import { z } from "zod";

/** POST /api/login: the shared passcode, or an email and password (AUTH_MODE=users). */
export const LoginBody = z.union([
  z.object({ passcode: z.string().max(200) }),
  z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) }),
]);
export type LoginBodyT = z.infer<typeof LoginBody>;
