import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

// Console access tokens. Edge-safe (used by middleware and Node routes).
//   AUTH_MODE=passcode: one shared passcode (hackathon). Cookie holds a hash of it.
//   AUTH_MODE=users:    per-user sign-in. Cookie holds a signed session (HS256, SESSION_SECRET).

/** Cookie holding the shared-passcode token (AUTH_MODE=passcode). */
export const GATE_COOKIE = "haazir_gate";
/** Cookie holding the signed session (AUTH_MODE=users). */
export const SESSION_COOKIE = "haazir_session";
/** How long a session lasts: 12 hours. */
export const SESSION_TTL_S = 12 * 3600;

/** The cookie value for a passcode: a SHA-256 hash, so the passcode itself is never stored in the browser. */
export async function gateToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`haazir:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Who is signed in, as carried in the session token. The role is re-read from the database on every request. */
export interface SessionClaims {
  uid: string;
  org: string;
  role: "admin" | "doctor";
  rid: string | null;
  name: string;
  email: string;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** A signed session token for these claims. Throws when the secret is shorter than 32 characters. */
export async function signSession(claims: SessionClaims, secret: string, ttlS = SESSION_TTL_S): Promise<string> {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlS}s`)
    .setIssuer("haazir")
    .sign(key(secret));
}

/** What a verified token must contain; anything else is refused. */
const ClaimsSchema = z.object({
  uid: z.string().min(1),
  org: z.string().min(1),
  role: z.enum(["admin", "doctor"]),
  rid: z.string().nullish().transform((v) => v ?? null),
  name: z.string().default(""),
  email: z.string().default(""),
});

/** The claims in a valid, unexpired token signed with this secret; null for anything else. */
export async function verifySession(token: string | undefined, secret: string): Promise<SessionClaims | null> {
  if (!token || secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: "haazir", algorithms: ["HS256"] });
    const claims = ClaimsSchema.safeParse(payload);
    return claims.success ? claims.data : null;
  } catch {
    return null;
  }
}
