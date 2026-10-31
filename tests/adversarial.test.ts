import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Devil's-advocate findings. Each test describes an attack or failure and must pass on the fixed code.
const deferred: Array<Promise<unknown>> = [];
const jar = new Map<string, string>();
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: (fn: unknown) => { deferred.push(Promise.resolve(typeof fn === "function" ? (fn as () => unknown)() : fn)); } };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
}));

import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { clientIp } from "@/lib/integrations/bolna/bolna.auth";
import { hashPassword } from "@/lib/modules/auth/password.helper";
import { parseQuickReply } from "@/lib/modules/intake/quick-reply.helper";
import { safeNext } from "@/lib/modules/auth/safe-next.helper";
import { sessionFromCookies } from "@/lib/modules/auth/session.service";
import { advanceSimulation, scenario } from "@/lib/modules/demo/simulator.service";
import { IDS, fakeClock, freshDb } from "./helpers";
import * as loginRoute from "@/app/api/login/route";
import * as referralsRoute from "@/app/api/referrals/route";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { FunctionService } from "@/lib/modules/call/function.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";
import type { ReferralInput } from "@/lib/modules/referral/referral.type";

const KRAIT = scenario.referral as unknown as ReferralInput;
const B = "https://app.example";
const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(B + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
async function settle() { while (deferred.length) await deferred.shift(); }

let db: Db;
let bolnaCalls: Array<{ agent_id: string }> = [];
function stubBolna() {
  vi.stubEnv("BOLNA_API_KEY", "k");
  vi.stubEnv("BOLNA_AGENT_ID_AVAILABILITY", "a");
  vi.stubEnv("BOLNA_AGENT_ID_HOLD_CONFIRM", "h");
  vi.stubEnv("BOLNA_AGENT_ID_RELEASE", "r");
  vi.stubEnv("BOLNA_AGENT_ID_FAMILY", "f");
  bolnaCalls = [];
  let n = 0;
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
    bolnaCalls.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify({ status: "queued", execution_id: `exec-${++n}` }), { status: 200 });
  }));
}

beforeEach(async () => {
  db = await freshDb();
  jar.clear();
  deferred.length = 0;
  vi.stubEnv("DEMO_PASSCODE", "");
  vi.stubEnv("AUTH_MODE", "passcode");
});
afterEach(async () => {
  await settle();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setClock(null);
  setDb(null);
  await db.close();
});

describe("access", () => {
  it("a production deploy that forgot DEMO_PASSCODE is closed, not open to the internet", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await sessionFromCookies(() => undefined)).toBeNull();
    vi.stubEnv("NODE_ENV", "development");
    expect(await sessionFromCookies(() => undefined)).not.toBeNull();
  });

  it("passcode guessing is throttled per IP", async () => {
    vi.stubEnv("DEMO_PASSCODE", "letmein");
    const ip = { "x-real-ip": "203.0.113.9" };
    for (let i = 0; i < 5; i++) expect((await loginRoute.POST(json("/api/login", { passcode: `guess${i}` }, ip))).status).toBe(401);
    expect((await loginRoute.POST(json("/api/login", { passcode: "letmein" }, ip))).status).toBe(429);
    expect((await loginRoute.POST(json("/api/login", { passcode: "letmein" }, { "x-real-ip": "198.51.100.1" }))).status).toBe(200);
  });

  it("password guessing is throttled per account, whatever the IP", async () => {
    vi.stubEnv("AUTH_MODE", "users");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    await db.query(`insert into app_users (org_id, email, name, password_hash, role) values ($1, 'a@x.org', 'A', $2, 'admin')`,
      ["00000000-0000-4000-8000-000000000001", await hashPassword("right-password-1")]);
    for (let i = 0; i < 5; i++) await loginRoute.POST(json("/api/login", { email: "a@x.org", password: `wrong${i}xx` }, { "x-real-ip": `10.0.0.${i}` }));
    expect((await loginRoute.POST(json("/api/login", { email: "a@x.org", password: "right-password-1" }, { "x-real-ip": "10.0.0.99" }))).status).toBe(429);
  });

  it("the post-login redirect can't be turned into an open redirect", () => {
    expect(safeNext("/referrals/abc")).toBe("/referrals/abc");
    for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "javascript:alert(1)", "\\\\evil.com", ""]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  it("console routes only accept JSON bodies (a cross-site form post can't drive them)", async () => {
    const form = new Request(B + "/api/referrals", {
      method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ ...KRAIT, simulate: true }),
    });
    expect((await referralsRoute.POST(form)).status).toBe(415);
  });

  it("a doctor can only refer as themselves", async () => {
    vi.stubEnv("AUTH_MODE", "users");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    const [other] = await db.query<{ id: string }>(`insert into referrers (name, phone_e164, facility_id) values ('Dr. Other', '+919800000888', $1) returning id`, [IDS.hoskote]);
    await db.query(`insert into app_users (org_id, email, name, password_hash, role, referrer_id) values ($1, 'doc@x.org', 'Doc', $2, 'doctor', $3)`,
      ["00000000-0000-4000-8000-000000000001", await hashPassword("right-password-1"), other.id]);
    const login = await loginRoute.POST(json("/api/login", { email: "doc@x.org", password: "right-password-1" }));
    const [n, v] = login.headers.get("set-cookie")!.split(";")[0].split("=");
    jar.set(n, v);
    const res = await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: IDS.referrer, simulate: true }));
    expect(res.status).toBe(201);
    const r = await ReferralRepository.get((await res.json()).id);
    expect(r!.referrer_id).toBe(other.id);
  });

  it("the IP allowlist can't be fooled by a forged x-forwarded-for", () => {
    const req = new Request(B, { headers: { "x-forwarded-for": "13.203.39.153, 203.0.113.7", "x-real-ip": "203.0.113.7" } });
    expect(clientIp(req)).toBe("203.0.113.7");
    expect(clientIp(new Request(B, { headers: { "x-forwarded-for": "13.203.39.153, 203.0.113.7" } }))).toBe("203.0.113.7");
  });
});

describe("abuse and cost", () => {
  it("a double-clicked 'Find a bed' creates one referral and one wave, not two", async () => {
    fakeClock();
    stubBolna();
    const body = { ...KRAIT, client_request_id: "6f2c1d2e-1111-4a5b-9c8d-0123456789ab" };
    const [a, b] = await Promise.all([referralsRoute.POST(json("/api/referrals", body)), referralsRoute.POST(json("/api/referrals", body))]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect((await a.json()).id).toBe((await b.json()).id);
    expect(await db.query(`select 1 from referrals`)).toHaveLength(1);
    expect(bolnaCalls).toHaveLength(6);
  });

  it("an organisation can't run unlimited live referrals at once", async () => {
    fakeClock();
    stubBolna();
    vi.stubEnv("MAX_ACTIVE_LIVE_REFERRALS", "2");
    await ReferralService.create(KRAIT);
    await ReferralService.create(KRAIT);
    await expect(ReferralService.create(KRAIT)).rejects.toMatchObject({ code: "TOO_MANY_ACTIVE_REFERRALS" });
    await expect(ReferralService.create(KRAIT, { simulate: true })).resolves.toBeTruthy(); // simulations don't call anyone
  });

  it("a desk that keeps saying 'call me back' is called back at most twice", async () => {
    const clock = fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    let current = (await CallRepository.listForReferral(referral.id))[0];
    for (let i = 0; i < 4; i++) {
      await FunctionService.requestCallback({ attempt_id: current.id, minutes: "1" });
      await (await WebhookService.handle({ id: current.bolna_execution_id, status: "completed" })).followUp();
      clock.advance(61);
      await ReferralService.evaluate(referral.id);
      const child = (await CallRepository.listForReferral(referral.id)).find((x) => x.parent_attempt_id === current.id);
      if (!child) break;
      current = child;
    }
    const tamarind = (await CallRepository.listForReferral(referral.id)).filter((x) => x.facility_id === current.facility_id && x.purpose === "availability");
    expect(tamarind.length).toBe(3); // the first call + two callbacks
  });
});

describe("safety: never a false yes", () => {
  it("'ok' on WhatsApp is not an acceptance", () => {
    expect(parseQuickReply("ok R-4821")).toBeNull();
    expect(parseQuickReply("okay")).toBeNull();
    expect(parseQuickReply("y")).toBeNull();
    expect(parseQuickReply("YES R-4821")?.answer).toBe("yes");
  });

  it("'accepted' with no bed is flagged for review, not treated as a yes", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[0];
    await FunctionService.recordResponse({ attempt_id: a.id, outcome: "accepted", bed_type: "none" });
    const after = (await CallRepository.listForReferral(referral.id)).find((x) => x.id === a.id)!;
    expect(after.needs_review).toBe(true);
    expect((await ReferralRepository.get(referral.id))!.status).not.toBe("options_ready");
  });

  it("an availability answer sent with a hold call's id is ignored", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[0];
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "completed" })).followUp();
    await FunctionService.recordResponse({ attempt_id: a.id, outcome: "accepted", bed_type: "icu" });
    await ReferralService.select(referral.id, a.id);
    const hold = (await CallRepository.listForReferral(referral.id)).find((x) => x.purpose === "hold_confirm")!;
    const res = await FunctionService.recordResponse({ attempt_id: hold.id, outcome: "declined" });
    expect(res.result).toBe("not_found");
    expect((await CallRepository.listForReferral(referral.id)).find((x) => x.id === hold.id)!.outcome).toBeNull();
  });
});

describe("privacy and accuracy", () => {
  it("the family call's transcript (their name, the patient's details) is never stored where the browser can read it", async () => {
    const clock = fakeClock();
    const { referral } = await ReferralService.create(KRAIT, { simulate: true });
    for (let t = 0; t < 45; t++) { await advanceSimulation(referral.id); await ReferralService.evaluate(referral.id); clock.advance(1); }
    const tam = (await CallRepository.listForReferral(referral.id)).find((x) => x.facility_id === IDS.tamarind && x.purpose === "availability")!;
    await ReferralService.select(referral.id, tam.id);
    for (let t = 0; t < 80; t++) { await advanceSimulation(referral.id); await ReferralService.evaluate(referral.id); clock.advance(1); }
    const fam = (await CallRepository.listForReferral(referral.id)).find((x) => x.purpose === "family_update")!;
    await db.query(`update call_attempts set status = 'wrapping_up', transcript = null where id = $1`, [fam.id]);
    await (await WebhookService.handle({ id: fam.bolna_execution_id, status: "completed", transcript: "Agent: Hello Lakshmi, about Ramesh…", telephony_data: { recording_url: "https://rec/1" } })).followUp();
    const stored = (await CallRepository.listForReferral(referral.id)).find((x) => x.id === fam.id)!;
    expect(stored.transcript).toBeNull();
    expect(stored.recording_url).toBeNull();
  });

  it("a yes that arrives after the referral was cancelled doesn't set the time-to-first-yes", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[0];
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "in-progress" })).followUp();
    await (await ReferralService.cancel(referral.id, "stabilised"))();
    await (await FunctionService.recordResponse({ attempt_id: a.id, outcome: "accepted" })).followUp();
    expect((await ReferralRepository.get(referral.id))!.first_acceptance_at).toBeNull();
  });

  it("a desk that says yes after the patient is placed hears that on the same call, with no extra release call", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const [first, second] = await CallRepository.listForReferral(referral.id);
    await FunctionService.recordResponse({ attempt_id: first.id, outcome: "accepted" });
    await (await ReferralService.confirmManually(referral.id, first.id, null))();
    await (await WebhookService.handle({ id: second.bolna_execution_id, status: "in-progress" })).followUp();
    const before = bolnaCalls.filter((c) => c.agent_id === "r").length;
    const res = await FunctionService.recordResponse({ attempt_id: second.id, outcome: "accepted" });
    await res.followUp();
    expect(res.instruction).toMatch(/already been placed/);
    expect(bolnaCalls.filter((c) => c.agent_id === "r").length).toBe(before);
    const rel = (await CallRepository.listForReferral(referral.id)).filter((x) => x.purpose === "release" && x.parent_attempt_id === second.id);
    expect(rel).toHaveLength(1);
    expect(rel[0].outcome).toBe("release_ack");
  });
});

describe("payload normalising", () => {
  it("keeps bed_type 'none' (no bed) but drops Python's 'None' (missing)", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const [a, b] = await CallRepository.listForReferral(referral.id);
    await FunctionService.recordResponse({ attempt_id: a.id, outcome: "declined", bed_type: "none" });
    await FunctionService.recordResponse({ attempt_id: b.id, outcome: "declined", bed_type: "None" });
    const all = await CallRepository.listForReferral(referral.id);
    expect(all.find((x) => x.id === a.id)!.bed_type).toBe("none");
    expect(all.find((x) => x.id === b.id)!.bed_type).toBeNull();
  });
});
