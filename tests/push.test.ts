import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { setClock } from "@/lib/core/clock";
import { setDb, type Db } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { hashPassword } from "@/lib/modules/auth/password.helper";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { PushRepository } from "@/lib/modules/push/push.repository";
import { PushService } from "@/lib/modules/push/push.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { IDS, fakeClock, freshDb } from "./helpers";
import { KRAIT, advanceCalls, fakeBolna } from "./support/scripted-calls";

import * as loginRoute from "@/app/api/login/route";
import * as pushRoute from "@/app/api/mobile/push-token/route";

const BASE = "https://app.example";
const DOC = "ExponentPushToken[doctorDevice000000000001]";
const SHARED = "ExponentPushToken[sharedDevice00000000002]";
const OTHER = "ExponentPushToken[otherDoctor0000000000003]";

const json = (path: string, method: string, body: unknown) =>
  new Request(BASE + path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

interface Sent {
  to: string;
  title: string;
  body: string;
  data: { referralId: string };
}
/** Stubs Expo's push endpoint on top of the fake Bolna; returns the messages sent. */
function fakeExpo(reply: (to: string[]) => Response = (to) => new Response(JSON.stringify({ data: to.map(() => ({ status: "ok" })) }), { status: 200 })) {
  const sent: Sent[] = [];
  const inner = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).includes("exp.host")) return inner(url, init);
    const batch = JSON.parse(String(init?.body)) as Sent[];
    sent.push(...batch);
    return reply(batch.map((m) => m.to));
  }));
  return sent;
}

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  jar.clear();
  reqHeaders.clear();
  vi.stubEnv("AUTH_MODE", "users");
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  const hash = await hashPassword("password-demo-1");
  const [other] = await db.query<{ id: string }>(
    `insert into referrers (name, phone_e164, org_id) values ('Dr. Other', '+919800000777', $1) returning id`, [DEFAULT_ORG_ID]);
  await db.query(
    `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values
     ($1, 'doc@demo.org', 'Dr. Meera', $2, 'doctor', $3), ($1, 'other@demo.org', 'Dr. Other', $2, 'doctor', $4)`,
    [DEFAULT_ORG_ID, hash, IDS.referrer, other.id],
  );
});
afterEach(async () => {
  await PushService.flush();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

async function signIn(email: string) {
  const res = await loginRoute.POST(
    new Request(BASE + "/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-haazir-client": "mobile" },
      body: JSON.stringify({ email, password: "password-demo-1" }),
    }),
  );
  reqHeaders.set("authorization", `Bearer ${(await res.json()).token}`);
}

describe("push token routes", () => {
  it("need a session and refuse anything that is not an Expo token", async () => {
    expect((await pushRoute.POST(json("/api/mobile/push-token", "POST", { token: DOC, platform: "ios" }))).status).toBe(401);
    await signIn("doc@demo.org");
    expect((await pushRoute.POST(json("/api/mobile/push-token", "POST", { token: "abc", platform: "ios" }))).status).toBe(422);
    expect((await pushRoute.POST(json("/api/mobile/push-token", "POST", { token: DOC, platform: "palm" }))).status).toBe(422);
    expect((await pushRoute.POST(json("/api/mobile/push-token", "POST", { token: DOC, platform: "ios" }))).status).toBe(200);
    expect(await PushRepository.has(DOC)).toBe(true);
  });

  it("a token saved twice stays one row, and moves to whoever signs in on that phone", async () => {
    await signIn("doc@demo.org");
    for (let i = 0; i < 2; i++) await pushRoute.POST(json("/api/mobile/push-token", "POST", { token: DOC, platform: "android" }));
    await signIn("other@demo.org");
    await pushRoute.POST(json("/api/mobile/push-token", "POST", { token: DOC, platform: "android" }));
    const rows = await db.query<{ email: string }>(`select u.email from push_tokens t join app_users u on u.id = t.user_id where t.token = $1`, [DOC]);
    expect(rows).toEqual([{ email: "other@demo.org" }]);
  });

  it("sign-out forgets the token", async () => {
    await signIn("doc@demo.org");
    await pushRoute.POST(json("/api/mobile/push-token", "POST", { token: DOC, platform: "ios" }));
    const res = await pushRoute.DELETE(json("/api/mobile/push-token", "DELETE", { token: DOC }));
    expect(await res.json()).toEqual({ removed: true });
    expect(await PushRepository.has(DOC)).toBe(false);
  });
});

describe("PushService.notify", () => {
  async function setup() {
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const doc = (await db.query<{ id: string }>(`select id from app_users where email = 'doc@demo.org'`))[0].id;
    const other = (await db.query<{ id: string }>(`select id from app_users where email = 'other@demo.org'`))[0].id;
    await PushRepository.upsert(DEFAULT_ORG_ID, doc, DOC, "ios");
    await PushRepository.upsert(DEFAULT_ORG_ID, null, SHARED, "android");
    await PushRepository.upsert(DEFAULT_ORG_ID, other, OTHER, "ios");
    return referral;
  }

  it("tells the referring doctor's phones and shared-passcode phones, not another doctor's", async () => {
    const referral = await setup();
    const sent = fakeExpo();
    await PushService.notify(referral.id, "first_yes", IDS.banyan);
    await PushService.flush();
    expect(sent.map((m) => m.to).sort()).toEqual([DOC, SHARED].sort());
    expect(sent[0].title).toBe(`First yes · ${referral.code}`);
    expect(sent[0].body).toContain("Banyan Multispeciality Hospital");
    expect(sent[0].data).toEqual({ referralId: referral.id });
  });

  it("never puts a patient or family detail in the text", async () => {
    const referral = await setup();
    // The krait-bite script already carries a patient name, a family contact and a number.
    const [pd] = await db.query<{ patient_name: string }>(`select patient_name from patient_details where referral_id = $1`, [referral.id]);
    expect(pd.patient_name).toContain("Ramesh");
    const sent = fakeExpo();
    for (const kind of ["first_yes", "doctor_wanted", "hospital_called_back", "bed_held", "bed_declined", "exhausted"] as const) {
      await PushService.notify(referral.id, kind, IDS.tamarind);
    }
    await PushService.flush();
    expect(sent.length).toBe(12);
    const text = JSON.stringify(sent);
    expect(text).not.toMatch(/Ramesh|Lakshmi|9800000301|snake|krait/i);
  });

  it("drops tokens Expo says are dead, and keeps going when Expo fails", async () => {
    const referral = await setup();
    fakeExpo((to) => new Response(JSON.stringify({ data: to.map((t) => (t === SHARED ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" })) }), { status: 200 }));
    await PushService.notify(referral.id, "bed_held", IDS.tamarind);
    await PushService.flush();
    expect(await PushRepository.has(SHARED)).toBe(false);
    expect(await PushRepository.has(DOC)).toBe(true);

    const failing = fakeExpo(() => new Response("down", { status: 503 }));
    await expect(PushService.notify(referral.id, "bed_held", IDS.tamarind)).resolves.toBeUndefined();
    await PushService.flush();
    expect(failing.length).toBe(1);
    expect(await PushRepository.has(DOC)).toBe(true);
  });

  it("sends nothing when no device is registered or the referral is unknown", async () => {
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const sent = fakeExpo();
    await PushService.notify(referral.id, "first_yes", IDS.banyan);
    await PushService.notify("00000000-0000-4000-8000-00000000dead", "first_yes");
    await PushService.flush();
    expect(sent).toEqual([]);
  });
});

describe("a krait-bite referral notifies the doctor at the moments that matter", () => {
  it("first yes, a desk wanting the doctor, then the bed held, each once", async () => {
    const clock = fakeClock();
    fakeBolna();
    const sent = fakeExpo();
    await PushRepository.upsert(DEFAULT_ORG_ID, null, SHARED, "android");
    const { referral } = await ReferralService.create(KRAIT);
    let selected = false;
    for (let t = 0; t <= 120; t++) {
      await advanceCalls(referral.id);
      await EvaluationService.evaluate(referral.id);
      const r = (await ReferralRepository.get(referral.id))!;
      if (!selected && r.status === "options_ready" && t >= 45) {
        const tamarind = (await CallRepository.listForReferral(referral.id)).find((a) => a.facility_id === IDS.tamarind && a.purpose === "availability")!;
        await HoldService.select(referral.id, tamarind.id);
        selected = true;
      }
      clock.advance(1);
      await PushService.flush();
    }
    const titles = sent.map((m) => m.title.split(" · ")[0]);
    expect(titles.filter((t) => t === "First yes")).toHaveLength(1);
    expect(titles.filter((t) => t === "A desk wants you")).toHaveLength(1);
    expect(titles.filter((t) => t === "Bed held")).toHaveLength(1);
    expect(sent.find((m) => m.title.startsWith("A desk wants you"))!.body).toContain("Jasmine Heart Institute");
    expect(sent.find((m) => m.title.startsWith("Bed held"))!.body).toContain("Tamarind District Hospital");
    // The first yes comes before the bed is held.
    expect(titles.indexOf("First yes")).toBeLessThan(titles.indexOf("Bed held"));
  });
});
