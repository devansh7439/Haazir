import { NextResponse } from "next/server";
import { errorResponse, handle, parseBody } from "@/lib/api";
import { env } from "@/lib/config";
import { now } from "@/lib/clock";
import { one, q } from "@/lib/db";
import { GATE_COOKIE, SESSION_COOKIE, SESSION_TTL_S, gateToken, signSession } from "@/lib/gate";
import { verifyPassword } from "@/lib/password";
import { LoginBody } from "@/lib/validation";

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, LoginBody);

    if (env.authMode === "users") {
      if (!("email" in body)) return errorResponse(422, "EMAIL_REQUIRED", "Sign in with your email and password");
      if (env.sessionSecret.length < 32) return errorResponse(500, "MISCONFIGURED", "SESSION_SECRET must be set (32+ characters)");
      const user = await one<{ id: string; org_id: string; role: "admin" | "doctor"; referrer_id: string | null; name: string; email: string; password_hash: string; active: boolean }>(
        `select id, org_id, role, referrer_id, name, email, password_hash, active from app_users where email = $1`,
        [body.email],
      );
      // Same message (and still a hash check) whether the email exists or not.
      const ok = await verifyPassword(body.password, user?.password_hash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
      if (!user || !user.active || !ok) return errorResponse(401, "WRONG_CREDENTIALS", "That email and password don't match");
      await q(`update app_users set last_login_at = $2 where id = $1`, [user.id, now()]);
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
    if (!expected || body.passcode.trim() !== expected) return errorResponse(401, "WRONG_PASSCODE", "That passcode isn't right");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(GATE_COOKIE, await gateToken(expected), cookieOpts(60 * 60 * 24 * 30));
    return res;
  });
}
