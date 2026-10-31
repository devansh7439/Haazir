import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { errorResponse, handle, parseBody } from "@/lib/core/route";
import { clientIp } from "@/lib/integrations/bolna/bolna.auth";
import { env } from "@/lib/core/config";
import { now } from "@/lib/core/clock";
import { AuthRepository } from "@/lib/modules/auth/auth.repository";
import { GATE_COOKIE, SESSION_COOKIE, SESSION_TTL_S, gateToken, signSession } from "@/lib/modules/auth/gate.helper";
import { verifyPassword } from "@/lib/modules/auth/password.helper";
import { ThrottleService, WINDOW_MIN } from "@/lib/modules/auth/throttle.service";
import { LoginBody } from "@/lib/modules/auth/auth.validation";

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

const throttled = () =>
  errorResponse(429, "TOO_MANY_ATTEMPTS", `Too many sign-in attempts. Try again in ${WINDOW_MIN} minutes.`);

// A real scrypt hash of a random string, so an unknown email costs the same time as a wrong password.
const DUMMY_HASH = "scrypt$16384$8$1$Zm9vYmFyYmF6cXV4cXV1eA==$iknE9vACLVEm4Ok0HTuqkisZYyPUvE/+uBgXY20+wbk=";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, LoginBody);
    const ipKey = `ip:${clientIp(req) || "unknown"}`;

    if (env.authMode === "users") {
      if (!("email" in body)) return errorResponse(422, "EMAIL_REQUIRED", "Sign in with your email and password");
      if (env.sessionSecret.length < 32) return errorResponse(500, "MISCONFIGURED", "SESSION_SECRET must be set (32+ characters)");
      const keys = [ipKey, `email:${body.email}`];
      if (await ThrottleService.isThrottled(keys)) return throttled();
      const user = await AuthRepository.byEmail(body.email);
      const ok = await verifyPassword(body.password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !user.active || !ok) {
        await ThrottleService.recordFailure(keys);
        return errorResponse(401, "WRONG_CREDENTIALS", "That email and password don't match");
      }
      await ThrottleService.clearFailures([`email:${body.email}`]);
      await AuthRepository.touchLastLogin(user.id, now());
      const token = await signSession(
        { uid: user.id, org: user.org_id, role: user.role, rid: user.referrer_id, name: user.name, email: user.email },
        env.sessionSecret,
      );
      const res = NextResponse.json({ ok: true });
      res.cookies.set(SESSION_COOKIE, token, cookieOpts(SESSION_TTL_S));
      return res;
    }

    if (!("passcode" in body)) return errorResponse(422, "PASSCODE_REQUIRED", "Enter the console passcode");
    const expected = env.demoPasscode;
    if (!expected) {
      return process.env.NODE_ENV === "production"
        ? errorResponse(500, "MISCONFIGURED", "DEMO_PASSCODE isn't set on this deployment, so the console is closed")
        : NextResponse.json({ ok: true }); // local development: no gate
    }
    if (await ThrottleService.isThrottled([ipKey])) return throttled();
    // Compare hashes, in constant time, so response timing says nothing about the passcode.
    const given = Buffer.from(await gateToken(body.passcode.trim()));
    if (!timingSafeEqual(given, Buffer.from(await gateToken(expected)))) {
      await ThrottleService.recordFailure([ipKey]);
      return errorResponse(401, "WRONG_PASSCODE", "That passcode isn't right");
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(GATE_COOKIE, await gateToken(expected), cookieOpts(60 * 60 * 24 * 30));
    return res;
  });
}
