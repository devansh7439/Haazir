import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A coordinator (dispatcher) places referrals for the doctors of their organisation, and the referral records who keyed it in.
const deferred: Array<Promise<unknown>> = [];
const jar = new Map<string, string>();
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: (fn: unknown) => { deferred.push(Promise.resolve(typeof fn === "function" ? (fn as () => unknown)() : fn)); } };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
  headers: async () => new Headers(),
}));

import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { hashPassword } from "@/lib/modules/auth/password.helper";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ViewService } from "@/lib/modules/referral/view.service";
import { KRAIT } from "./support/scripted-calls";
import { IDS, fakeClock, freshDb } from "./helpers";
import * as loginRoute from "@/app/api/login/route";
import * as referralsRoute from "@/app/api/referrals/route";

const B = "https://app.example";
const ORG = "00000000-0000-4000-8000-000000000001";
const ORG_B = "00000000-0000-4000-8000-0000000000b1";
const json = (path: string, body: unknown) =>
  new Request(B + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

let db: Db;

function stubBolna() {
  vi.stubEnv("BOLNA_API_KEY", "k");
  vi.stubEnv("BOLNA_AGENT_ID_AVAILABILITY", "a");
  vi.stubEnv("BOLNA_AGENT_ID_HOLD_CONFIRM", "h");
  vi.stubEnv("BOLNA_AGENT_ID_RELEASE", "r");
  vi.stubEnv("BOLNA_AGENT_ID_FAMILY", "f");
  let n = 0;
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "queued", execution_id: `exec-${++n}` }), { status: 200 })));
}

/** Creates a console user and signs in as them: the session cookie is then sent with every route call. */
async function signInAs(role: "admin" | "doctor" | "coordinator", name: string, referrerId: string | null = null): Promise<string> {
  const email = `${role}-${name.toLowerCase().replace(/\W+/g, "")}@x.org`;
  const [u] = await db.query<{ id: string }>(
    `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values ($1, $2, $3, $4, $5, $6) returning id`,
    [ORG, email, name, await hashPassword("right-password-1"), role, referrerId],
  );
  const login = await loginRoute.POST(json("/api/login", { email, password: "right-password-1" }));
  expect(login.status).toBe(200);
  const [n, v] = login.headers.get("set-cookie")!.split(";")[0].split("=");
  jar.set(n, v);
  return u.id;
}

beforeEach(async () => {
  db = await freshDb();
  jar.clear();
  deferred.length = 0;
  fakeClock();
  stubBolna();
  vi.stubEnv("DEMO_PASSCODE", "");
  vi.stubEnv("AUTH_MODE", "users");
  vi.stubEnv("SESSION_SECRET", "s".repeat(40));
});
afterEach(async () => {
  while (deferred.length) await deferred.shift();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setClock(null);
  setDb(null);
  await db.close();
});

describe("a coordinator placing a referral for a doctor", () => {
  it("refers for any doctor of the organisation and is recorded as the one who keyed it in", async () => {
    const coordinator = await signInAs("coordinator", "Asha Dispatcher");
    const res = await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: IDS.referrer }));
    expect(res.status).toBe(201);
    const r = await ReferralRepository.get((await res.json()).id);
    expect(r!.referrer_id).toBe(IDS.referrer);
    expect(r!.entered_by).toBe(coordinator);
  });

  it("cannot refer for a doctor of another organisation", async () => {
    await db.query(`insert into organisations (id, name) values ($1, 'Other hospital network')`, [ORG_B]);
    const [stranger] = await db.query<{ id: string }>(
      `insert into referrers (name, phone_e164, org_id) values ('Dr. Stranger', '+919800000777', $1) returning id`,
      [ORG_B],
    );
    await signInAs("coordinator", "Asha Dispatcher");
    const res = await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: stranger.id }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("UNKNOWN_REFERRER");
    expect(await db.query(`select 1 from referrals`)).toHaveLength(0);
  });

  it("a doctor still refers only as themselves, and is not shown as keyed in by someone else", async () => {
    const [own] = await db.query<{ id: string }>(
      `insert into referrers (name, phone_e164, facility_id) values ('Dr. Own', '+919800000555', $1) returning id`,
      [IDS.hoskote],
    );
    const doctor = await signInAs("doctor", "Dr Own", own.id);
    const res = await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: IDS.referrer }));
    expect(res.status).toBe(201);
    const r = await ReferralRepository.get((await res.json()).id);
    expect(r!.referrer_id).toBe(own.id);
    expect(r!.entered_by).toBe(doctor);
    expect((await ViewService.queue(ORG))[0].entered_by_name).toBeNull();
  });
});

describe("the queue", () => {
  it("lists the live referrals with who keyed each one in, and leaves out the finished", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    const first = await (await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: IDS.referrer }))).json();
    const second = await (await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: IDS.referrer }))).json();
    await db.query(`update referrals set status = 'closed' where id = $1`, [second.id]);

    const queue = await ViewService.queue(ORG);
    expect(queue.map((r) => r.id)).toEqual([first.id]);
    expect(queue[0]).toMatchObject({ entered_by_name: "Asha Dispatcher", status: "searching", calls_open: 6 });
  });

  it("does not show another organisation's referrals", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: IDS.referrer }));
    await db.query(`insert into organisations (id, name) values ($1, 'Other hospital network')`, [ORG_B]);
    expect(await ViewService.queue(ORG_B)).toEqual([]);
  });
});
