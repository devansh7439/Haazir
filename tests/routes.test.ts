import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers are called directly. after() runs its work inline (and we wait for it); cookies() reads a test jar.
const deferred: Array<Promise<unknown>> = [];
const jar = new Map<string, string>();
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return {
    ...mod,
    after: (fn: unknown) => {
      deferred.push(Promise.resolve(typeof fn === "function" ? (fn as () => unknown)() : fn));
    },
  };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
}));

import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { SESSION_COOKIE } from "@/lib/gate";
import { hashPassword } from "@/lib/password";
import { purgeIdentifiers } from "@/lib/maintenance";
import { advanceSimulation, scenario } from "@/lib/simulator";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { IDS, fakeClock, freshDb } from "./helpers";

import * as webhookRoute from "@/app/api/bolna/webhook/route";
import * as recordResponseRoute from "@/app/api/bolna/functions/record-response/route";
import * as cronRoute from "@/app/api/cron/tick/route";
import * as loginRoute from "@/app/api/login/route";
import * as referralsRoute from "@/app/api/referrals/route";
import * as referralRoute from "@/app/api/referrals/[id]/route";
import * as previewRoute from "@/app/api/referrals/preview/route";
import * as facilitiesRoute from "@/app/api/facilities/route";
import * as facilityRoute from "@/app/api/facilities/[id]/route";
import * as demoStatusRoute from "@/app/api/demo/status/route";
import * as missedCallRoute from "@/app/api/triggers/missed-call/route";
import * as whatsappRoute from "@/app/api/whatsapp/inbound/route";
import * as portalRoute from "@/app/api/portal-snapshots/route";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";
import type { ReferralInput } from "@/lib/modules/referral/referral.type";

const KRAIT = scenario.referral as unknown as ReferralInput;
const BASE = "https://app.example";

function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}) {
  return new Request(BASE + path, {
    method: init.method ?? "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function settle() {
  while (deferred.length) await deferred.shift();
}

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  jar.clear();
  deferred.length = 0;
  vi.stubEnv("BOLNA_WEBHOOK_SECRET", "whsec");
  vi.stubEnv("BOLNA_FUNCTION_SECRET", "fnsec");
  vi.stubEnv("CRON_SECRET", "cronsec");
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

describe("Bolna routes", () => {
  it("webhook: rejects a wrong token, accepts junk quietly", async () => {
    expect((await webhookRoute.POST(req("/api/bolna/webhook", { body: { id: "x", status: "ringing" } }))).status).toBe(401);
    expect((await webhookRoute.POST(req("/api/bolna/webhook?token=nope", { body: {} }))).status).toBe(401);
    const ok = await webhookRoute.POST(req("/api/bolna/webhook?token=whsec", { raw: "not json" }));
    expect(ok.status).toBe(200);
    expect((await webhookRoute.POST(req("/api/bolna/webhook?token=whsec", { body: { id: "unknown", status: "ringing" } }))).status).toBe(200);
  });

  it("functions: 401 without the bearer token; always 200 with an instruction otherwise, even when the database fails", async () => {
    expect((await recordResponseRoute.POST(req("/api/bolna/functions/record-response", { body: {} }))).status).toBe(401);
    const auth = { authorization: "Bearer fnsec" };
    const junk = await recordResponseRoute.POST(req("/api/bolna/functions/record-response", { raw: "garbage", headers: auth }));
    expect(junk.status).toBe(200);
    expect(typeof (await junk.json()).instruction).toBe("string");
    setDb({ query: async () => { throw new Error("db down"); }, exec: async () => {}, close: async () => {} });
    const down = await recordResponseRoute.POST(req("/api/bolna/functions/record-response", { body: { outcome: "accepted" }, headers: auth }));
    expect(down.status).toBe(200);
    expect(await down.json()).toEqual({ result: "error", instruction: "Thank them for their help and end the call." });
    setDb(db);
  });

  it("optional IP allowlist only admits Bolna's addresses", async () => {
    vi.stubEnv("BOLNA_IP_ALLOWLIST", "on");
    const body = { id: "x", status: "ringing" };
    expect((await webhookRoute.POST(req("/api/bolna/webhook?token=whsec", { body, headers: { "x-real-ip": "1.2.3.4" } }))).status).toBe(401);
    // A forged leftmost x-forwarded-for entry doesn't help; the proxy-reported address is what counts.
    expect((await webhookRoute.POST(req("/api/bolna/webhook?token=whsec", { body, headers: { "x-forwarded-for": "13.203.39.153, 1.2.3.4" } }))).status).toBe(401);
    expect((await webhookRoute.POST(req("/api/bolna/webhook?token=whsec", { body, headers: { "x-real-ip": "13.203.39.153" } }))).status).toBe(200);
  });
});

describe("cron tick", () => {
  it("needs CRON_SECRET and advances referrals with no console open", async () => {
    const clock = fakeClock();
    expect((await cronRoute.GET(req("/api/cron/tick", { method: "GET" }))).status).toBe(401);
    const { referral } = await ReferralService.create(KRAIT, { simulate: true });
    for (let t = 0; t < 45; t++) {
      clock.advance(1);
      const res = await cronRoute.GET(req("/api/cron/tick", { method: "GET", headers: { authorization: "Bearer cronsec" } }));
      expect(res.status).toBe(200);
    }
    const r = (await ReferralRepository.get(referral.id))!;
    expect(r.status).toBe("options_ready");
    expect(r.first_acceptance_at).not.toBeNull();
  });
});

describe("passcode mode (single organisation)", () => {
  it("creates a referral and rejects identifiers in the note", async () => {
    const created = await referralsRoute.POST(req("/api/referrals", { body: { ...KRAIT, simulate: true } }));
    expect(created.status).toBe(201);
    const bad = await referralsRoute.POST(req("/api/referrals", { body: { ...KRAIT, note: "son 9845012345", simulate: true } }));
    expect(bad.status).toBe(422);
    expect((await bad.json()).error.code).toBe("NOTE_CONTAINS_IDENTIFIER");
  });

  it("requires the passcode when one is set", async () => {
    vi.stubEnv("DEMO_PASSCODE", "letmein");
    expect((await referralsRoute.GET()).status).toBe(401);
    const login = await loginRoute.POST(req("/api/login", { body: { passcode: "letmein" } }));
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0].split("=");
    jar.set(cookie[0], cookie[1]);
    expect((await referralsRoute.GET()).status).toBe(200);
  });
});

describe("user accounts and organisation isolation", () => {
  const ORG_B = "00000000-0000-4000-8000-0000000000b0";

  async function signIn(email: string, password: string) {
    jar.clear();
    const res = await loginRoute.POST(req("/api/login", { body: { email, password } }));
    if (res.status === 200) {
      const [name, value] = res.headers.get("set-cookie")!.split(";")[0].split("=");
      jar.set(name, value);
    }
    return res.status;
  }

  beforeEach(async () => {
    vi.stubEnv("AUTH_MODE", "users");
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
    await db.query(`insert into organisations (id, name) values ($1, 'Other hospital network')`, [ORG_B]);
    const [refB] = await db.query<{ id: string }>(`insert into referrers (name, phone_e164, org_id) values ('Dr. B', '+919800000999', $1) returning id`, [ORG_B]);
    const hash = await hashPassword("password-demo-1");
    await db.query(
      `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values
       ($1, 'admin@demo.org', 'Demo Admin', $2, 'admin', $3),
       ($4, 'doc@other.org', 'Dr. B', $2, 'doctor', $5)`,
      [DEFAULT_ORG_ID, hash, IDS.referrer, ORG_B, refB.id],
    );
  });

  it("signs in with email and password, and rejects wrong ones", async () => {
    expect(await signIn("admin@demo.org", "wrong-password")).toBe(401);
    expect(await signIn("nobody@demo.org", "password-demo-1")).toBe(401);
    expect(await signIn("ADMIN@demo.org", "password-demo-1")).toBe(200);
    expect(jar.get(SESSION_COOKIE)).toBeTruthy();
    jar.clear();
    expect((await referralsRoute.GET()).status).toBe(401);
  });

  it("never shows one organisation's referrals, hospitals or demo console to another", async () => {
    await signIn("admin@demo.org", "password-demo-1");
    const created = await referralsRoute.POST(req("/api/referrals", { body: { ...KRAIT, simulate: true } }));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    expect((await referralRoute.GET(req(`/api/referrals/${id}`, { method: "GET" }), params(id))).status).toBe(200);
    expect((await demoStatusRoute.GET()).status).toBe(200);

    await signIn("doc@other.org", "password-demo-1");
    expect((await referralRoute.GET(req(`/api/referrals/${id}`, { method: "GET" }), params(id))).status).toBe(404);
    expect((await (await referralsRoute.GET()).json()).referrals).toEqual([]);
    expect((await (await facilitiesRoute.GET()).json()).facilities).toEqual([]);
    expect((await demoStatusRoute.GET()).status).toBe(403);
    // Using the demo org's referrer from org B is refused like an unknown referrer.
    const cross = await previewRoute.POST(req("/api/referrals/preview", { body: KRAIT }));
    expect(cross.status).toBe(422);
    // A doctor can't edit hospitals; an admin from another org can't see this one.
    expect((await facilityRoute.PATCH(req(`/api/facilities/${IDS.tamarind}`, { method: "PATCH", body: { active: false } }), params(IDS.tamarind))).status).toBe(403);
  });

  it("deactivating a user ends their session immediately", async () => {
    await signIn("admin@demo.org", "password-demo-1");
    expect((await referralsRoute.GET()).status).toBe(200);
    await db.query(`update app_users set active = false where email = 'admin@demo.org'`);
    expect((await referralsRoute.GET()).status).toBe(401);
  });
});

describe("missed-call trigger (C3) and family call (C1)", () => {
  it("calls the family back for their confirmed referral", async () => {
    vi.stubEnv("MISSED_CALL_SECRET", "mc");
    const clock = fakeClock();
    const { referral } = await ReferralService.create(KRAIT, { simulate: true });
    for (let t = 0; t < 45; t++) { await advanceSimulation(referral.id); await ReferralService.evaluate(referral.id); clock.advance(1); }
    const tamarind = (await CallRepository.listForReferral(referral.id)).find((a) => a.facility_id === IDS.tamarind && a.purpose === "availability")!;
    await ReferralService.select(referral.id, tamarind.id);
    for (let t = 0; t < 40; t++) { await advanceSimulation(referral.id); await ReferralService.evaluate(referral.id); clock.advance(1); }
    expect((await ReferralRepository.get(referral.id))!.status).toBe("confirmed");
    // The handoff placed one family call; its row holds only a masked number.
    let family = (await CallRepository.listForReferral(referral.id)).filter((a) => a.purpose === "family_update");
    expect(family).toHaveLength(1);
    expect(family[0].to_number).toBe("+91 ••••• ••301");

    expect((await missedCallRoute.POST(req("/api/triggers/missed-call", { body: { from: "+910000000301" } }))).status).toBe(401);
    clock.advance(11 * 60);
    const res = await missedCallRoute.POST(req("/api/triggers/missed-call?token=mc", { body: { from: "+910000000301" } }));
    expect(await res.json()).toEqual({ ok: true, action: "family_call" });
    await settle();
    family = (await CallRepository.listForReferral(referral.id)).filter((a) => a.purpose === "family_update");
    expect(family).toHaveLength(2);
    const unknown = await missedCallRoute.POST(req("/api/triggers/missed-call?token=mc", { raw: "From=%2B919999999999", headers: { "content-type": "application/x-www-form-urlencoded" } }));
    expect((await unknown.json()).action).toBe("no_referral");
  });
});

describe("WhatsApp inbound (C2, C6)", () => {
  function twilio(body: Record<string, string>) {
    const url = `${BASE}/api/whatsapp/inbound`;
    const sig = createHmac("sha1", "twtok").update(url + Object.keys(body).sort().map((k) => k + body[k]).join("")).digest("base64");
    return new Request(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": sig },
      body: new URLSearchParams(body).toString(),
    });
  }
  beforeEach(() => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "twtok");
    vi.stubEnv("APP_BASE_URL", BASE);
  });

  it("rejects unsigned requests", async () => {
    const res = await whatsappRoute.POST(new Request(`${BASE}/api/whatsapp/inbound`, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "From=whatsapp%3A%2B1&Body=yes",
    }));
    expect(res.status).toBe(401);
  });

  it("records a desk's WhatsApp YES with the reference, and refuses to guess without one", async () => {
    fakeClock();
    await db.query(`update facilities set whatsapp_number = '+919800000101' where id = $1`, [IDS.banyan]);
    const a = await ReferralService.create(KRAIT, { simulate: true });
    const b = await ReferralService.create(KRAIT, { simulate: true });
    // Two open requests to Banyan: a bare "yes" is ambiguous.
    await whatsappRoute.POST(twilio({ From: "whatsapp:+919800000101", Body: "yes" }));
    await settle();
    const banyanA = () => CallRepository.listForReferral(a.referral.id).then((x) => x.find((y) => y.facility_id === IDS.banyan)!);
    expect((await banyanA()).outcome).toBeNull();
    await whatsappRoute.POST(twilio({ From: "whatsapp:+919800000101", Body: `YES ${a.referral.code} send the case sheet` }));
    await settle();
    const rec = await banyanA();
    expect(rec.outcome).toBe("conditional");
    expect(rec.outcome_source).toBe("whatsapp");
    expect(rec.conditions).toBe("send the case sheet");
    expect((await CallRepository.listForReferral(b.referral.id)).find((y) => y.facility_id === IDS.banyan)!.outcome).toBeNull();
    expect((await ReferralRepository.get(a.referral.id))!.status).toBe("options_ready");
  });

  it("turns a doctor's message into a draft without exposing the transcript", async () => {
    await whatsappRoute.POST(twilio({ From: "whatsapp:+910000000201", Body: "34 yr male krait bite, ptosis, critical" }));
    await settle();
    const [d] = await db.query<{ parsed: { case_type: string; acuity: string }; status: string; org_id: string }>(`select parsed, status, org_id from intake_drafts`);
    expect(d).toMatchObject({ status: "new", org_id: DEFAULT_ORG_ID, parsed: { case_type: "snakebite_neuro", acuity: "critical" } });
  });
});

describe("missed-webhook recovery, portal flags, retention", () => {
  it("asks Bolna for a call stuck on ringing and applies the answer", async () => {
    const clock = fakeClock();
    vi.stubEnv("BOLNA_API_KEY", "k");
    vi.stubEnv("BOLNA_AGENT_ID_AVAILABILITY", "agent");
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const m = String(url).match(/\/executions\/(exec-\d+)/);
      if (m) {
        // Only exec-1's webhook was lost; Bolna still reports the others as queued.
        const body = m[1] === "exec-1" ? { id: m[1], status: "no-answer", termination_reason: "no_answer" } : { id: m[1], status: "queued" };
        return new Response(JSON.stringify(body), { status: 200 });
      }
      return new Response(JSON.stringify({ status: "queued", execution_id: `exec-${++n}` }), { status: 200 });
    }));
    const { referral } = await ReferralService.create(KRAIT);
    const target = (await CallRepository.listForReferral(referral.id)).find((a) => a.bolna_execution_id === "exec-1")!;
    await db.query(`update call_attempts set status = 'ringing', updated_at = $2 where id = $1`, [target.id, clock.now]);
    clock.advance(30);
    expect(await WebhookService.recoverStale(referral.id)).toBe(0); // not stale yet
    clock.advance(70);
    expect(await WebhookService.recoverStale(referral.id)).toBe(1);
    const after = (await CallRepository.listForReferral(referral.id)).find((a) => a.id === target.id)!;
    expect(after.status).toBe("no_answer");
    expect(await WebhookService.recoverStale(referral.id)).toBe(0); // terminal now; never polled again
  });

  it("flags a desk's decline that contradicts a fresh portal reading", async () => {
    const clock = fakeClock();
    const res = await portalRoute.POST(req("/api/portal-snapshots", {
      body: { snapshots: [{ facility_id: IDS.neem, source: "Test portal", icu_beds_free: 3, ventilators_free: 2, observed_at: new Date().toISOString() }] },
    }));
    expect(res.status).toBe(201);
    const { referral } = await ReferralService.create(KRAIT, { simulate: true });
    for (let t = 0; t < 40; t++) { await advanceSimulation(referral.id); await ReferralService.evaluate(referral.id); clock.advance(1); }
    const flags = await db.query<{ payload: { detail: string } }>(`select payload from events where referral_id = $1 and type = 'portal_mismatch'`, [referral.id]);
    // Neem declines with "no ventilator: ICU full, no ventilator free"; the ventilator reading is the one that contradicts it first.
    expect(flags.map((f) => f.payload.detail)).toEqual(["portal showed 2 ventilators free"]);
  });

  it("purges identifiers 30 days after a referral ends, keeping the de-identified record", async () => {
    const clock = fakeClock();
    const { referral } = await ReferralService.create(KRAIT, { simulate: true });
    await db.query(`update referrals set status = 'closed', closed_at = $2 where id = $1`, [referral.id, clock.now]);
    clock.advance(29 * 86400);
    expect((await purgeIdentifiers(30)).patient_details).toBe(0);
    clock.advance(2 * 86400);
    expect((await purgeIdentifiers(30)).patient_details).toBe(1);
    expect(await ReferralRepository.get(referral.id)).not.toBeNull();
  });
});
