import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { env } from "@/lib/core/config";
import { one } from "@/lib/core/db";
import { GATE_COOKIE, SESSION_COOKIE, gateToken, verifySession } from "@/lib/modules/auth/gate.helper";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { ApiError } from "@/lib/core/error";

// Who is calling a console route, and which organisation's data they may see.
// Passcode mode has one implicit admin in the demo organisation.

export interface Session {
  uid: string | null;
  org: string;
  role: "admin" | "doctor";
  rid: string | null;
  name: string | null;
  email: string | null;
}

const PASSCODE_SESSION: Session = { uid: null, org: DEFAULT_ORG_ID, role: "admin", rid: null, name: null, email: null };

export async function sessionFromCookies(get: (name: string) => string | undefined): Promise<Session | null> {
  if (env.authMode === "users") {
    const claims = await verifySession(get(SESSION_COOKIE), env.sessionSecret);
    if (!claims) return null;
    // Deactivated users lose access immediately, not when the cookie expires.
    const user = await one<{ active: boolean; org_id: string; role: "admin" | "doctor"; referrer_id: string | null }>(
      `select active, org_id, role, referrer_id from app_users where id = $1`,
      [claims.uid],
    );
    if (!user?.active || user.org_id !== claims.org) return null;
    return { uid: claims.uid, org: user.org_id, role: user.role, rid: user.referrer_id, name: claims.name, email: claims.email };
  }
  const passcode = env.demoPasscode;
  // No passcode is only acceptable on a developer's machine; a production deploy without one stays closed.
  if (!passcode) return process.env.NODE_ENV === "production" ? null : PASSCODE_SESSION;
  return get(GATE_COOKIE) === (await gateToken(passcode)) ? PASSCODE_SESSION : null;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return sessionFromCookies((name) => jar.get(name)?.value);
}

/** The demo console works on the fictional demo directory, which lives in the demo organisation. */
export async function requireDemoAdmin(): Promise<Session> {
  const s = await requireSession({ admin: true });
  if (s.org !== DEFAULT_ORG_ID) throw ApiError.forbidden("The demo console is only available in the demo organisation");
  return s;
}

/** For server pages: the session, or a redirect to sign-in. */
export async function pageSession(opts: { admin?: boolean; demo?: boolean } = {}): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if ((opts.admin || opts.demo) && s.role !== "admin") notFound();
  if (opts.demo && s.org !== DEFAULT_ORG_ID) notFound();
  return s;
}

export async function requireSession(opts: { admin?: boolean } = {}): Promise<Session> {
  const s = await getSession();
  if (!s) throw ApiError.unauthorized("Sign in to the console");
  if (opts.admin && s.role !== "admin") throw ApiError.forbidden("Only an admin can do that");
  return s;
}
