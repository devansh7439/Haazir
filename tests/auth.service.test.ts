import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/modules/auth/password.helper";
import { AuthService } from "@/lib/modules/auth/auth.service";
import { freshDb } from "./helpers";

// The sign-in decisions without HTTP: what each attempt returns, and which cookie it earns.

beforeEach(async () => {
  await freshDb();
});
afterEach(() => vi.unstubAllEnvs());

describe("AuthService.signIn, passcode mode", () => {
  it("gives the gate cookie for the right passcode and a 401 for a wrong one", async () => {
    vi.stubEnv("DEMO_PASSCODE", "letmein");
    const wrong = await AuthService.signIn({ passcode: "nope" }, "1.1.1.1");
    expect(wrong).toMatchObject({ ok: false, status: 401, code: "WRONG_PASSCODE" });
    const right = await AuthService.signIn({ passcode: " letmein " }, "1.1.1.1");
    expect(right).toMatchObject({ ok: true, cookie: { name: "haazir_gate" } });
  });

  it("asks for a passcode when given an email, and stays open only outside production", async () => {
    vi.stubEnv("DEMO_PASSCODE", "letmein");
    expect(await AuthService.signIn({ email: "a@x.org", password: "x" }, "1.1.1.1")).toMatchObject({ status: 422, code: "PASSCODE_REQUIRED" });
    vi.stubEnv("DEMO_PASSCODE", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(await AuthService.signIn({ passcode: "" }, "1.1.1.1")).toEqual({ ok: true, cookie: null });
    vi.stubEnv("NODE_ENV", "production");
    expect(await AuthService.signIn({ passcode: "" }, "1.1.1.1")).toMatchObject({ ok: false, status: 500, code: "MISCONFIGURED" });
  });
});

describe("AuthService.signIn, users mode", () => {
  it("signs in an active user, and treats an unknown email like a wrong password", async () => {
    vi.stubEnv("AUTH_MODE", "users");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    const db = await freshDb();
    await db.query(
      `insert into app_users (org_id, email, name, password_hash, role) values ($1, 'a@x.org', 'A', $2, 'admin')`,
      ["00000000-0000-4000-8000-000000000001", await hashPassword("right-password-1")],
    );
    expect(await AuthService.signIn({ email: "a@x.org", password: "right-password-1" }, "2.2.2.2")).toMatchObject({ ok: true, cookie: { name: "haazir_session" } });
    const wrong = await AuthService.signIn({ email: "a@x.org", password: "wrong-password-1" }, "2.2.2.2");
    const unknown = await AuthService.signIn({ email: "nobody@x.org", password: "wrong-password-1" }, "2.2.2.2");
    expect(unknown).toEqual(wrong);
    expect(wrong).toMatchObject({ status: 401, code: "WRONG_CREDENTIALS" });
  });

  it("refuses a passcode, and refuses to sign anything without a long SESSION_SECRET", async () => {
    vi.stubEnv("AUTH_MODE", "users");
    vi.stubEnv("SESSION_SECRET", "short");
    expect(await AuthService.signIn({ passcode: "x" }, "3.3.3.3")).toMatchObject({ status: 422, code: "EMAIL_REQUIRED" });
    expect(await AuthService.signIn({ email: "a@x.org", password: "x" }, "3.3.3.3")).toMatchObject({ status: 500, code: "MISCONFIGURED" });
  });
});
