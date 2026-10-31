import "server-only";
import { timingSafeEqual } from "node:crypto";
import { now } from "@/lib/core/clock";
import { env } from "@/lib/core/config";
import { AuthRepository, type Role } from "@/lib/modules/auth/auth.repository";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import type { LoginBodyT } from "@/lib/modules/auth/auth.validation";
import { GATE_COOKIE, SESSION_COOKIE, SESSION_TTL_S, gateToken, signSession } from "@/lib/modules/auth/gate.helper";
import { hashPassword, verifyPassword } from "@/lib/modules/auth/password.helper";
import { ThrottleService, WINDOW_MIN } from "@/lib/modules/auth/throttle.service";

/** A cookie to set on success; null when the sign-in needs none (local development without a passcode). */
export type SignInResult =
  | { ok: true; cookie: { name: string; value: string; maxAge: number } | null }
  | { ok: false; status: number; code: string; message: string };

const PASSCODE_COOKIE_TTL_S = 60 * 60 * 24 * 30;

// A real scrypt hash of a random string, so an unknown email costs the same time as a wrong password.
const DUMMY_HASH = "scrypt$16384$8$1$Zm9vYmFyYmF6cXV4cXV1eA==$iknE9vACLVEm4Ok0HTuqkisZYyPUvE/+uBgXY20+wbk=";

const fail = (status: number, code: string, message: string): SignInResult => ({ ok: false, status, code, message });
const throttled = (): SignInResult => fail(429, "TOO_MANY_ATTEMPTS", `Too many sign-in attempts. Try again in ${WINDOW_MIN} minutes.`);

const signInWithPassword = async (body: Extract<LoginBodyT, { email: string }>, ipKey: string): Promise<SignInResult> => {
  if (env.sessionSecret.length < 32) return fail(500, "MISCONFIGURED", "SESSION_SECRET must be set (32+ characters)");
  const keys = [ipKey, `email:${body.email}`];
  if (await ThrottleService.isThrottled(keys)) return throttled();
  const user = await AuthRepository.byEmail(body.email);
  const ok = await verifyPassword(body.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.active || !ok) {
    await ThrottleService.recordFailure(keys);
    return fail(401, "WRONG_CREDENTIALS", "That email and password don't match");
  }
  await ThrottleService.clearFailures([`email:${body.email}`]);
  await AuthRepository.touchLastLogin(user.id, now());
  const token = await signSession(
    { uid: user.id, org: user.org_id, role: user.role, rid: user.referrer_id, name: user.name, email: user.email },
    env.sessionSecret,
  );
  return { ok: true, cookie: { name: SESSION_COOKIE, value: token, maxAge: SESSION_TTL_S } };
};

const signInWithPasscode = async (given: string, ipKey: string): Promise<SignInResult> => {
  const expected = env.demoPasscode;
  if (!expected) {
    return process.env.NODE_ENV === "production"
      ? fail(500, "MISCONFIGURED", "DEMO_PASSCODE isn't set on this deployment, so the console is closed")
      : { ok: true, cookie: null }; // local development: no gate
  }
  if (await ThrottleService.isThrottled([ipKey])) return throttled();
  // Compare hashes, in constant time, so response timing says nothing about the passcode.
  const a = Buffer.from(await gateToken(given.trim()));
  const b = Buffer.from(await gateToken(expected));
  if (!timingSafeEqual(a, b)) {
    await ThrottleService.recordFailure([ipKey]);
    return fail(401, "WRONG_PASSCODE", "That passcode isn't right");
  }
  return { ok: true, cookie: { name: GATE_COOKIE, value: b.toString(), maxAge: PASSCODE_COOKIE_TTL_S } };
};

/** What the create-user script collects. Without an organisation the user joins the demo one. */
export interface NewUser {
  email: string;
  name: string;
  password: string;
  role: Role;
  orgId?: string;
  orgName?: string;
  referrer?: { phone_e164: string; facility_id: string | null };
}

/** Console sign-in: the shared passcode or an email and password, depending on AUTH_MODE. */
export const AuthService = {
  /** Decides a sign-in attempt. Failures count against the caller's IP (and the account, in users mode). */
  signIn: async (body: LoginBodyT, ip: string): Promise<SignInResult> => {
    const ipKey = `ip:${ip || "unknown"}`;
    if (env.authMode === "users") {
      return "email" in body ? signInWithPassword(body, ipKey) : fail(422, "EMAIL_REQUIRED", "Sign in with your email and password");
    }
    return "passcode" in body ? signInWithPasscode(body.passcode, ipKey) : fail(422, "PASSCODE_REQUIRED", "Enter the console passcode");
  },

  /** Creates (or updates) a console user, their organisation if it is new, and their referrer record. Returns the ids. */
  createUser: async (u: NewUser): Promise<{ id: string; orgId: string; referrerId: string | null }> => {
    const orgId = u.orgName ? await AuthRepository.organisationByName(u.orgName) : (u.orgId ?? DEFAULT_ORG_ID);
    const referrerId = u.referrer ? await AuthRepository.insertReferrer({ name: u.name, org_id: orgId, ...u.referrer }) : null;
    const id = await AuthRepository.upsertUser({
      org_id: orgId,
      email: u.email,
      name: u.name,
      password_hash: await hashPassword(u.password),
      role: u.role,
      referrer_id: referrerId,
    });
    return { id, orgId, referrerId };
  },
};
