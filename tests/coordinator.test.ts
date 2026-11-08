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
import * as notesRoute from "@/app/api/referrals/[id]/notes/route";
import * as importRoute from "@/app/api/facilities/import/route";
import { MaintenanceService } from "@/lib/modules/maintenance/maintenance.service";
import { addMinutes, now } from "@/lib/core/clock";

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
async function signInAs(role: "admin" | "doctor" | "coordinator", name: string, referrerId: string | null = null, org = ORG): Promise<string> {
  const email = `${role}-${name.toLowerCase().replace(/\W+/g, "")}@x.org`;
  const [u] = await db.query<{ id: string }>(
    `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values ($1, $2, $3, $4, $5, $6) returning id`,
    [org, email, name, await hashPassword("right-password-1"), role, referrerId],
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

describe("handover notes", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const get = (id: string) => notesRoute.GET(new Request(`${B}/api/referrals/${id}/notes`), params(id));
  const post = (id: string, body: unknown) => notesRoute.POST(json(`/api/referrals/${id}/notes`, body), params(id));
  const place = async () => (await (await referralsRoute.POST(json("/api/referrals", { ...KRAIT, referrer_id: IDS.referrer }))).json()).id as string;

  it("lists a referral's notes newest first, under the name of whoever wrote them", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    const id = await place();
    expect((await post(id, { body: "Called Banyan, waiting on Dr Kiran." })).status).toBe(201);
    await signInAs("coordinator", "Ravi Night");
    expect((await post(id, { body: "Banyan confirmed the ventilator." })).status).toBe(201);
    const { notes } = await (await get(id)).json();
    expect(notes.map((n: { body: string; author_name: string }) => [n.author_name, n.body])).toEqual([
      ["Ravi Night", "Banyan confirmed the ventilator."],
      ["Asha Dispatcher", "Called Banyan, waiting on Dr Kiran."],
    ]);
  });

  it("refuses an empty note and one that holds a phone number, an ID or an email", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    const id = await place();
    for (const body of ["   ", "family on 98450 12345", "aadhaar 1234 5678 9012", "mail me at a@b.org"]) {
      expect((await post(id, { body })).status).toBe(422);
    }
    expect(await db.query(`select 1 from referral_notes`)).toHaveLength(0);
  });

  it("is invisible to another organisation, like the referral itself", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    const id = await place();
    await post(id, { body: "Called Banyan." });
    await db.query(`insert into organisations (id, name) values ($1, 'Other hospital network')`, [ORG_B]);
    await signInAs("coordinator", "Outsider", null, ORG_B);
    expect((await get(id)).status).toBe(404);
    expect((await post(id, { body: "Hello" })).status).toBe(404);
  });

  it("shows the newest note on the queue", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    const id = await place();
    expect((await ViewService.queue(ORG))[0]).toMatchObject({ last_note: null, last_note_by: null });
    await post(id, { body: "Called Banyan." });
    await post(id, { body: "Banyan said yes." });
    expect((await ViewService.queue(ORG))[0]).toMatchObject({ last_note: "Banyan said yes.", last_note_by: "Asha Dispatcher" });
  });

  it("is deleted with the other identifiers once the referral ended long ago", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    const live = await place();
    const ended = await place();
    await post(live, { body: "Still going." });
    await post(ended, { body: "Done." });
    await db.query(`update referrals set status = 'closed', closed_at = $2 where id = $1`, [ended, addMinutes(now(), -40 * 24 * 60)]);
    expect((await MaintenanceService.purgeIdentifiers(30)).notes).toBe(1);
    expect((await db.query<{ referral_id: string }>(`select referral_id from referral_notes`)).map((r) => r.referral_id)).toEqual([live]);
  });
});

describe("importing a hospital directory", () => {
  const CSV = [
    "name,kind,city,lat,lng,language,casualty_phone,services",
    "Pine Valley Hospital,private hospital,Hoskote,13.10,77.80,en,9845012301,ICU bed; Ventilator",
    "Broken Row,private hospital,Hoskote,13.10,77.80,en,123,ICU bed",
  ].join("\n");
  const post = (apply: boolean) => importRoute.POST(json("/api/facilities/import", { csv: CSV, apply }));
  const listed = () => db.query<{ id: string; name: string }>(`select id, name from facilities where name = 'Pine Valley Hospital'`);

  it("checks a file without saving anything, then lists the good rows and reports the bad one", async () => {
    await signInAs("admin", "Admin One");
    const check = await (await post(false)).json();
    expect(check).toMatchObject({ applied: false, hospitals: [{ line: 2, name: "Pine Valley Hospital" }] });
    expect(check.issues).toEqual([expect.objectContaining({ line: 3, name: "Broken Row" })]);
    expect(await listed()).toHaveLength(0);

    const done = await (await post(true)).json();
    expect(done).toMatchObject({ applied: true, hospitals: [{ line: 2, name: "Pine Valley Hospital" }] });
    const [f] = await listed();
    expect(await db.query(`select 1 from facility_contacts where facility_id = $1 and phone_e164 = '+919845012301'`, [f.id])).toHaveLength(1);
    expect((await db.query<{ capability_code: string }>(`select capability_code from facility_capabilities where facility_id = $1`, [f.id])).map((c) => c.capability_code).sort())
      .toEqual(["icu_bed", "ventilator"]);
  });

  it("does not list a hospital twice when the same file is imported again", async () => {
    await signInAs("admin", "Admin One");
    await post(true);
    const again = await (await post(true)).json();
    expect(again.hospitals).toEqual([]);
    expect(again.issues.map((i: { message: string }) => i.message)).toContain("Already listed.");
    expect(await listed()).toHaveLength(1);
  });

  it("lists the hospitals under the admin's own organisation", async () => {
    await db.query(`insert into organisations (id, name) values ($1, 'Other hospital network')`, [ORG_B]);
    await signInAs("admin", "Admin Two", null, ORG_B);
    await post(true);
    expect((await db.query<{ org_id: string }>(`select org_id from facilities where name = 'Pine Valley Hospital'`)).map((f) => f.org_id)).toEqual([ORG_B]);
  });

  it("is for an admin only", async () => {
    await signInAs("coordinator", "Asha Dispatcher");
    expect((await post(true)).status).toBe(403);
    expect(await listed()).toHaveLength(0);
  });
});
