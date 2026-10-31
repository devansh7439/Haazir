import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/lib/modules/auth/gate.helper";

const SECRET = "x".repeat(40);
const claims = { uid: "u1", org: "o1", role: "doctor" as const, rid: null, name: "Dr A", email: "a@x.in" };
const signRaw = (payload: Record<string, unknown>) =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").setIssuer("haazir").sign(new TextEncoder().encode(SECRET));

describe("session claims", () => {
  it("round-trips a valid session", async () => {
    expect(await verifySession(await signSession(claims, SECRET), SECRET)).toEqual(claims);
  });

  it("refuses a correctly signed token whose claims have the wrong types", async () => {
    expect(await verifySession(await signRaw({ ...claims, uid: 42 }), SECRET)).toBeNull();
    expect(await verifySession(await signRaw({ ...claims, role: "owner" }), SECRET)).toBeNull();
    expect(await verifySession(await signRaw({ ...claims, org: "" }), SECRET)).toBeNull();
  });

  it("fills a missing name or email with an empty string", async () => {
    const bare = { uid: claims.uid, org: claims.org, role: claims.role, rid: null };
    expect(await verifySession(await signRaw(bare), SECRET)).toMatchObject({ name: "", email: "" });
  });
});
