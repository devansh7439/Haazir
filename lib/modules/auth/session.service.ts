import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { env } from "@/lib/core/config";
import { AuthRepository } from "@/lib/modules/auth/auth.repository";
import { GATE_COOKIE, SESSION_COOKIE, bearerToken, gateToken, verifySession } from "@/lib/modules/auth/gate.helper";
import { DEFAULT_ORG_ID, type Role } from "@/lib/core/types";
import { ApiError } from "@/lib/core/error";

// Who is calling a console route, and which organisation's data they may see.
// Passcode mode has one implicit admin in the demo organisation.

export interface Session {
  uid: string | null;
  org: string;
  role: Role;
  rid: string | null;
  name: string | null;
  email: string | null;
}

const PASSCODE_SESSION: Session = { uid: null, org: DEFAULT_ORG_ID, role: "admin", rid: null, name: null, email: null };

/** Read once per page render: the layout and the page both ask, and in users mode each ask is a database read. */
const currentSession = cache(async (): Promise<Session | null> => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const bearer = bearerToken(h);
  return SessionService.fromCookies((name) => jar.get(name)?.value ?? bearer);
});

/** Who is calling a console route or page. */
export const SessionService = {
  /** The signed-in session from the request's cookies, or null. In users mode the account must still be active. */
  fromCookies: async (get: (name: string) => string | undefined): Promise<Session | null> => {
    if (env.authMode === "users") {
      const claims = await verifySession(get(SESSION_COOKIE), env.sessionSecret);
      if (!claims) return null;
      // Deactivated users lose access immediately, not when the cookie expires.
      const user = await AuthRepository.access(claims.uid);
      if (!user?.active || user.org_id !== claims.org) return null;
      return { uid: claims.uid, org: user.org_id, role: user.role, rid: user.referrer_id, name: claims.name, email: claims.email };
    }
    const passcode = env.demoPasscode;
    // No passcode is only acceptable on a developer's machine; a production deploy without one stays closed.
    if (!passcode) return process.env.NODE_ENV === "production" ? null : PASSCODE_SESSION;
    return get(GATE_COOKIE) === (await gateToken(passcode)) ? PASSCODE_SESSION : null;
  },

  /** The session for the current request (cookie, or `Authorization: Bearer` for the mobile app), or null when nobody is signed in. */
  get: (): Promise<Session | null> => currentSession(),

  /** For server pages: the session, or a redirect to sign-in. 404 when an admin is needed and the user is not one. */
  page: async (opts: { admin?: boolean } = {}): Promise<Session> => {
    const s = await SessionService.get();
    if (!s) redirect("/login");
    if (opts.admin && s.role !== "admin") notFound();
    return s;
  },

  /** The session, or a 401 when nobody is signed in and a 403 when an admin is needed and the user is not one. */
  require: async (opts: { admin?: boolean } = {}): Promise<Session> => {
    const s = await SessionService.get();
    if (!s) throw ApiError.unauthorized("Sign in to the console");
    if (opts.admin && s.role !== "admin") throw ApiError.forbidden("Only an admin can do that");
    return s;
  },
};
