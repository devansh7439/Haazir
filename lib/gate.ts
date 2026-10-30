import { SignJWT, jwtVerify } from "jose";

// Console access tokens. Edge-safe (used by middleware and Node routes).
//   AUTH_MODE=passcode: one shared passcode (hackathon). Cookie holds a hash of it.
//   AUTH_MODE=users:    per-user sign-in. Cookie holds a signed session (HS256, SESSION_SECRET).

export const GATE_COOKIE = "haazir_gate";
export const SESSION_COOKIE = "haazir_session";
export const SESSION_TTL_S = 12 * 3600;

export async function gateToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`haazir:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

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

export async function signSession(claims: SessionClaims, secret: string, ttlS = SESSION_TTL_S): Promise<string> {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlS}s`)
    .setIssuer("haazir")
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionClaims | null> {
  if (!token || secret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { issuer: "haazir", algorithms: ["HS256"] });
    const p = payload as unknown as Partial<SessionClaims>;
    if (!p.uid || !p.org || (p.role !== "admin" && p.role !== "doctor")) return null;
    return { uid: p.uid, org: p.org, role: p.role, rid: p.rid ?? null, name: p.name ?? "", email: p.email ?? "" };
  } catch {
    return null;
  }
}
