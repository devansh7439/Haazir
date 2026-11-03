import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers are called directly; cookies() and headers() read test stores.
const jar = new Map<string, string>();
const reqHeaders = new Map<string, string>();
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: () => {} };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
  headers: async () => new Headers([...reqHeaders]),
}));

import { NextRequest } from "next/server";
import { setClock } from "@/lib/core/clock";
import { setDb, type Db } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { hashPassword } from "@/lib/modules/auth/password.helper";
import { IDS, freshDb } from "./helpers";
import { KRAIT } from "./support/scripted-calls";
import { middleware } from "@/middleware";

import * as loginRoute from "@/app/api/login/route";
import * as referralsRoute from "@/app/api/referrals/route";
import * as configRoute from "@/app/api/mobile/config/route";
import * as bootstrapRoute from "@/app/api/mobile/bootstrap/route";

const BASE = "https://app.example";
const login = (body: unknown, mobile = true) =>
  loginRoute.POST(
    new Request(BASE + "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", ...(mobile ? { "x-haazir-client": "mobile" } : {}) },
      body: JSON.stringify(body),
    }),
  );
const gate = async (path: string, headers: Record<string, string> = {}) =>
  (await middleware(new NextRequest(BASE + path, { headers }))).status;

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  jar.clear();
  reqHeaders.clear();
  vi.stubEnv("AUTH_MODE", "passcode");
  vi.stubEnv("DEMO_PASSCODE", "letmein");
  vi.stubEnv("BOLNA_FUNCTION_SECRET", "fnsec");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

describe("mobile sign-in with a Bearer token (passcode mode)", () => {
  it("returns a token only to the mobile client, and the token opens the console", async () => {
    const web = await (await login({ passcode: "letmein" }, false)).json();
    expect(web).toEqual({ ok: true });

    const res = await login({ passcode: "letmein" });
    const { token } = await res.json();
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    expect((await referralsRoute.GET()).status).toBe(401);
    reqHeaders.set("authorization", `Bearer ${token}`);
    expect((await referralsRoute.GET()).status).toBe(200);
  });

  it("refuses a wrong passcode and a wrong or foreign token", async () => {
    expect((await login({ passcode: "nope" })).status).toBe(401);
    reqHeaders.set("authorization", "Bearer not-a-token");
    expect((await referralsRoute.GET()).status).toBe(401);
    // Bolna's function secret is sent as a Bearer token too; it must not open the console.
    reqHeaders.set("authorization", "Bearer fnsec");
    expect((await referralsRoute.GET()).status).toBe(401);
  });

  it("the middleware admits the same token, and the config route is public", async () => {
    const { token } = await (await login({ passcode: "letmein" })).json();
    expect(await gate("/api/referrals")).toBe(401);
    expect(await gate("/api/referrals", { authorization: "Bearer wrong" })).toBe(401);
    expect(await gate("/api/referrals", { authorization: `Bearer ${token}` })).toBe(200);
    expect(await gate("/api/mobile/config")).toBe(200);
    expect(await gate("/api/mobile/bootstrap")).toBe(401);
  });
});

describe("mobile sign-in with an account (users mode)", () => {
  beforeEach(async () => {
    vi.stubEnv("AUTH_MODE", "users");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    await db.query(
      `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values ($1, 'doc@demo.org', 'Dr. Meera', $2, 'doctor', $3)`,
      [DEFAULT_ORG_ID, await hashPassword("password-demo-1"), IDS.referrer],
    );
  });

  it("reports the sign-in mode before anyone is signed in", async () => {
    expect(await (await configRoute.GET()).json()).toEqual({ auth_mode: "users" });
  });

  it("the token works until the account is deactivated", async () => {
    const { token } = await (await login({ email: "DOC@demo.org", password: "password-demo-1" })).json();
    expect(token.split(".")).toHaveLength(3);
    reqHeaders.set("authorization", `Bearer ${token}`);
    expect((await referralsRoute.GET()).status).toBe(200);
    expect(await gate("/api/referrals", { authorization: `Bearer ${token}` })).toBe(200);
    await db.query(`update app_users set active = false`);
    expect((await referralsRoute.GET()).status).toBe(401);
  });

  it("bootstrap gives the form its referrer, case templates and capabilities", async () => {
    expect((await bootstrapRoute.GET()).status).toBe(401);
    const { token } = await (await login({ email: "doc@demo.org", password: "password-demo-1" })).json();
    reqHeaders.set("authorization", `Bearer ${token}`);
    const res = await bootstrapRoute.GET();
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.user).toEqual({ name: "Dr. Meera", email: "doc@demo.org", role: "doctor" });
    expect(b.referrer.id).toBe(IDS.referrer);
    expect(b.templates.map((t: { case_type: string }) => t.case_type)).toContain(KRAIT.case_type);
    expect(b.capabilities.length).toBeGreaterThan(5);
    expect(b.bolna_ready).toBe(false);
  });
});
