import fs from "node:fs";
import path from "node:path";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Security sweep: every console route needs a session, admin routes need an admin, no route crosses organisations,
// forged sessions are refused, the browser never sees identifiers, and the database exposes nothing through
// Supabase's public roles (anon = the public key in the browser bundle; authenticated = our realtime token).

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
import { migrate, setDb } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { SESSION_COOKIE, signSession } from "@/lib/gate";
import { hashPassword } from "@/lib/password";
import { createReferral, evaluateReferral, selectAttempt, type ReferralInput } from "@/lib/orchestrator";
import { advanceSimulation, scenario } from "@/lib/simulator";
import { getAttempts, getReferral } from "@/lib/repo";
import { redactNumbers } from "@/lib/core/normalize";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { IDS, fakeClock, freshDb } from "./helpers";
import * as loginRoute from "@/app/api/login/route";
import * as referralRoute from "@/app/api/referrals/[id]/route";
import * as referralsRoute from "@/app/api/referrals/route";
import * as facilitiesRoute from "@/app/api/facilities/route";

const KRAIT = scenario.referral as unknown as ReferralInput;
const ORG_B = "00000000-0000-4000-8000-0000000000b0";
const SECRET = "s".repeat(40);
const PASSWORD = "password-demo-1";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

// Routes that authenticate with their own secret or signature (or are the sign-in itself).
const SELF_AUTHED = ["bolna/", "cron/", "whatsapp/", "triggers/", "login", "logout"];
// [route, method] pairs only an admin may call. Kept in step with the source by the "admin list is complete" test.
const ADMIN_ONLY = [
  "POST facilities", "PATCH facilities/[id]", "PUT facilities/[id]/capabilities", "POST facilities/[id]/contacts",
  "PATCH contacts/[id]", "POST portal-snapshots", "POST demo/assign-numbers", "POST demo/portal-sample",
  "POST demo/reset", "POST demo/run", "GET demo/status", "POST demo/test-call",
];

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
interface Route { path: string; method: string; handler: Handler; source: string }

async function discoverRoutes(): Promise<Route[]> {
  const root = path.join(process.cwd(), "app/api");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "route.ts") files.push(p);
    }
  };
  walk(root);
  const out: Route[] = [];
  for (const file of files.sort()) {
    const rel = path.relative(root, path.dirname(file)).split(path.sep).join("/");
    const mod = (await import(file)) as Record<string, unknown>;
    for (const m of METHODS) {
      if (typeof mod[m] === "function") out.push({ path: rel, method: m, handler: mod[m] as Handler, source: fs.readFileSync(file, "utf8") });
    }
  }
  return out;
}

const BASE = "https://app.example";
function req(p: string, method: string, body: unknown = {}) {
  return new Request(`${BASE}/api/${p}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function settle() {
  while (deferred.length) await deferred.shift();
}
async function call(r: Route, id = IDS.tamarind, body: unknown = {}) {
  const res = await r.handler(req(r.path.replace("[id]", id), r.method, body), ctx(id));
  await settle();
  return res;
}

async function signIn(email: string) {
  jar.clear();
  const res = await loginRoute.POST(
    new Request(`${BASE}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) }),
  );
  expect(res.status).toBe(200);
  const [name, value] = res.headers.get("set-cookie")!.split(";")[0].split("=");
  jar.set(name, value);
}

let db: Db;
let routes: Route[];
let doctorId: string;

beforeEach(async () => {
  db = await freshDb();
  jar.clear();
  deferred.length = 0;
  vi.stubEnv("AUTH_MODE", "users");
  vi.stubEnv("SESSION_SECRET", SECRET);
  vi.stubEnv("DEMO_PASSCODE", "");
  vi.stubEnv("BOLNA_WEBHOOK_SECRET", "whsec");
  vi.stubEnv("BOLNA_FUNCTION_SECRET", "fnsec");
  routes ??= await discoverRoutes();
  await db.query(`insert into organisations (id, name) values ($1, 'Other hospital network')`, [ORG_B]);
  const [refB] = await db.query<{ id: string }>(
    `insert into referrers (name, phone_e164, org_id) values ('Dr. B', '+919800000999', $1) returning id`, [ORG_B]);
  const hash = await hashPassword(PASSWORD);
  const users = await db.query<{ id: string; email: string }>(
    `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values
     ($1, 'admin@demo.org', 'Demo Admin', $2, 'admin', $3),
     ($1, 'doc@demo.org', 'Demo Doctor', $2, 'doctor', $3),
     ($4, 'admin@other.org', 'Other Admin', $2, 'admin', $5)
     returning id, email`,
    [DEFAULT_ORG_ID, hash, IDS.referrer, ORG_B, refB.id],
  );
  doctorId = users.find((u) => u.email === "doc@demo.org")!.id;
});
afterEach(async () => {
  await settle();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

const consoleRoutes = () => routes.filter((r) => !SELF_AUTHED.some((p) => r.path.startsWith(p)));
const key = (r: Route) => `${r.method} ${r.path}`;

describe("route access control", () => {
  it("finds every API route", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it("every console route refuses a request with no session (401), before reading the body", async () => {
    const failures: string[] = [];
    for (const r of consoleRoutes()) {
      const res = await call(r);
      if (res.status !== 401) failures.push(`${key(r)} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it("every self-authenticated route refuses a request with no secret or signature", async () => {
    const failures: string[] = [];
    for (const r of routes.filter((x) => SELF_AUTHED.some((p) => x.path.startsWith(p)) && !["login", "logout"].includes(x.path))) {
      const res = await call(r);
      const ok = res.status === 401 || res.status === 403 || (r.path === "whatsapp/inbound" && r.method === "GET");
      if (!ok) failures.push(`${key(r)} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it("the admin list is complete: every admin check in the source is covered", () => {
    const fromSource = new Set<string>();
    for (const r of routes) {
      const fn = r.source.split(/export async function /).find((s) => s.startsWith(`${r.method}(`)) ?? "";
      if (/requireSession\(\{ admin: true \}\)|requireDemoAdmin\(/.test(fn)) fromSource.add(key(r));
    }
    expect([...fromSource].sort()).toEqual([...ADMIN_ONLY].sort());
  });

  it("a doctor gets 403 from every admin-only route", async () => {
    await signIn("doc@demo.org");
    const failures: string[] = [];
    for (const r of routes.filter((x) => ADMIN_ONLY.includes(key(x)))) {
      const res = await call(r);
      if (res.status !== 403) failures.push(`${key(r)} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it("an admin from another organisation gets 404 from every route that takes an id from this one", async () => {
    vi.stubEnv("AUTH_MODE", "passcode"); // create demo-org data through the orchestrator
    const { referral, attempts } = await createReferral(KRAIT, { simulate: true, orgId: DEFAULT_ORG_ID });
    vi.stubEnv("AUTH_MODE", "users");
    const [contact] = await db.query<{ id: string }>(`select id from facility_contacts where facility_id = $1 limit 1`, [IDS.tamarind]);
    const ids: Record<string, string> = {
      "referrals/[id]": referral.id,
      "attempts/[id]": attempts[0].id,
      "facilities/[id]": IDS.tamarind,
      "contacts/[id]": contact.id,
    };
    const before = JSON.stringify(await db.query(`select status, current_wave from referrals where id = $1`, [referral.id]));
    const facilityBefore = JSON.stringify(await db.query(`select * from facilities where id = $1`, [IDS.tamarind]));

    await signIn("admin@other.org");
    const failures: string[] = [];
    for (const r of consoleRoutes().filter((x) => x.path.includes("[id]") && !x.path.startsWith("intake-drafts"))) {
      const prefix = Object.keys(ids).find((p) => r.path.startsWith(p))!;
      const res = await call(r, ids[prefix], { attempt_id: attempts[0].id, outcome: "accepted", reason: "other", active: false, codes: [], phone: "+919800000111", role: "other", event_id: 1 });
      if (res.status !== 404) failures.push(`${key(r)} → ${res.status}`);
    }
    expect(failures).toEqual([]);
    // Nothing changed in the other organisation's data.
    expect(JSON.stringify(await db.query(`select status, current_wave from referrals where id = $1`, [referral.id]))).toBe(before);
    expect(JSON.stringify(await db.query(`select * from facilities where id = $1`, [IDS.tamarind]))).toBe(facilityBefore);
  });

  it("an intake draft from another organisation can't be dismissed", async () => {
    const [d] = await db.query<{ id: string }>(
      `insert into intake_drafts (org_id, kind, transcript) values ($1, 'text', 'x') returning id`, [DEFAULT_ORG_ID]);
    await signIn("admin@other.org");
    const r = routes.find((x) => x.path === "intake-drafts/[id]/dismiss")!;
    await call(r, d.id);
    const [after] = await db.query<{ status: string }>(`select status from intake_drafts where id = $1`, [d.id]);
    expect(after.status).toBe("new");
  });

  it("an accepted answer from another referral can't be selected or confirmed", async () => {
    const a = await createReferral(KRAIT, { simulate: true, orgId: DEFAULT_ORG_ID });
    const b = await createReferral({ ...KRAIT, client_request_id: "00000000-0000-4000-8000-0000000000c1" } as ReferralInput, { simulate: true, orgId: DEFAULT_ORG_ID });
    await db.query(`update call_attempts set outcome = 'accepted', bed_type = 'icu_with_ventilator' where id = $1`, [a.attempts[0].id]);
    await db.query(`update referrals set status = 'options_ready' where id = $1`, [b.referral.id]);
    await expect(selectAttempt(b.referral.id, a.attempts[0].id)).rejects.toMatchObject({ status: 409 });
  });
});

describe("session tokens", () => {
  const claims = (uid: string, role: "admin" | "doctor", org = DEFAULT_ORG_ID) =>
    ({ uid, org, role, rid: IDS.referrer, name: "x", email: "x@demo.org" });

  async function status(token: string) {
    jar.clear();
    jar.set(SESSION_COOKIE, token);
    return (await referralsRoute.GET()).status;
  }

  it("refuses tokens signed with another key, unsigned, expired or for another organisation", async () => {
    const good = await signSession(claims(doctorId, "doctor"), SECRET);
    expect(await status(good)).toBe(200);
    expect(await status(await signSession(claims(doctorId, "doctor"), "x".repeat(40)))).toBe(401);
    const [h, p] = good.split(".");
    const none = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    expect(await status(`${none}.${p}.`)).toBe(401);
    expect(await status(`${h}.${p}.`)).toBe(401);
    const expired = await new SignJWT({ ...claims(doctorId, "doctor") })
      .setProtectedHeader({ alg: "HS256" }).setIssuer("haazir").setIssuedAt(1).setExpirationTime(2)
      .sign(new TextEncoder().encode(SECRET));
    expect(await status(expired)).toBe(401);
    expect(await status(await signSession(claims(doctorId, "doctor", ORG_B), SECRET))).toBe(401);
    expect(await status("garbage")).toBe(401);
  });

  it("takes the role from the database, not from the token", async () => {
    jar.clear();
    jar.set(SESSION_COOKIE, await signSession(claims(doctorId, "admin"), SECRET));
    const res = await facilitiesRoute.POST(req("facilities", "POST", { name: "X", lat: 13, lng: 77 }));
    expect(res.status).toBe(403);
  });

  it("the session cookie is httpOnly and SameSite", async () => {
    const res = await loginRoute.POST(
      new Request(`${BASE}/api/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "doc@demo.org", password: PASSWORD }) }),
    );
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });
});

describe("no identifiers reach the browser", () => {
  it("referral responses never contain the patient's or family's details, even after handoff", async () => {
    const clock = fakeClock();
    await signIn("admin@demo.org");
    const created = await referralsRoute.POST(req("referrals", "POST", { ...KRAIT, simulate: true }));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    let selected = false;
    for (let t = 0; t <= 240; t++) {
      await advanceSimulation(id);
      await evaluateReferral(id);
      const r = await getReferral(id);
      if (!selected && r!.status === "options_ready" && t >= 45) {
        const tamarind = (await getAttempts(id)).find((a) => a.facility_id === IDS.tamarind && a.purpose === "availability")!;
        await selectAttempt(id, tamarind.id);
        selected = true;
      }
      clock.advance(1);
    }
    expect((await getReferral(id))!.status).toBe("confirmed");
    expect((await db.query(`select count(*)::int as n from messages where referral_id = $1`, [id]))[0]).toMatchObject({ n: expect.any(Number) });

    const one = await (await referralRoute.GET(req(`referrals/${id}`, "GET"), ctx(id))).text();
    const list = await (await referralsRoute.GET()).text();
    const events = JSON.stringify(await db.query(`select payload from events where referral_id = $1`, [id]));
    for (const text of [one, list, events]) {
      expect(text).not.toContain("Ramesh");
      expect(text).not.toContain("Lakshmi");
      expect(text).not.toContain("0000000301");
    }
  });

  it("phone numbers in provider error messages are masked before they reach an event", () => {
    expect(redactNumbers("Invalid recipient_phone_number +919800000301")).not.toContain("9800000301");
    expect(redactNumbers("number 98000 00301 is not valid")).not.toContain("00301");
    expect(redactNumbers("call (980) 000-0301 failed")).not.toMatch(/000.?0301/);
    expect(redactNumbers("to 98.000.00301")).not.toContain("00301");
    expect(redactNumbers("Bolna POST /call failed with 400")).toBe("Bolna POST /call failed with 400");
  });
});

// ------------------------------------------------------------------------------------------------
// Database exposure through Supabase's roles. A fresh embedded Postgres set up the way Supabase is:
// anon and authenticated roles, auth.jwt(), and default grants of everything in `public` to both roles
// (that is what the REST API at <project>.supabase.co/rest/v1 serves with the public anon key).
// ------------------------------------------------------------------------------------------------

const SUPABASE_LIKE = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.jwt() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;
// Reference data the browser may read without signing in.
const PUBLIC_REFERENCE = ["capabilities", "case_templates"];

describe("database exposure (Supabase roles)", () => {
  let sb: Db;
  let pg: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>; exec: (s: string) => Promise<unknown>; close: () => Promise<void> };

  beforeEach(async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    pg = new PGlite() as unknown as typeof pg;
    sb = {
      query: async <T,>(s: string, p: unknown[] = []) => (await pg.query(s, p)).rows as T[],
      exec: async (s: string) => { await pg.exec(s); },
      close: () => pg.close(),
    };
    await sb.exec(SUPABASE_LIKE);
    await migrate(sb);
    setDb(sb);
    await createReferral(KRAIT, { simulate: true, orgId: DEFAULT_ORG_ID });
    await sb.query(`insert into organisations (id, name) values ($1, 'Other hospital network')`, [ORG_B]);
    await sb.query(`insert into patient_details (referral_id, patient_name) select id, 'Ramesh' from referrals on conflict do nothing`);
  });
  afterEach(async () => {
    setDb(db);
    await sb.close();
  });

  async function as<T>(role: "anon" | "authenticated", org: string | null, fn: () => Promise<T>): Promise<T | "denied"> {
    const claims = JSON.stringify(org ? { role, org_id: org } : { role });
    await pg.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
    await pg.exec(`set role ${role}`);
    try {
      return await fn();
    } catch {
      return "denied";
    } finally {
      await pg.exec(`reset role`);
    }
  }

  async function relations(): Promise<string[]> {
    const rows = await sb.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') order by 1`);
    return rows.map((r) => r.relname);
  }

  async function visible(role: "anon" | "authenticated", org: string | null): Promise<Record<string, number | "denied">> {
    const out: Record<string, number | "denied"> = {};
    for (const rel of await relations()) {
      const res = await as(role, org, async () => (await sb.query<{ n: number }>(`select count(*)::int as n from "${rel}"`))[0].n);
      out[rel] = res;
    }
    return out;
  }

  const leaks = (seen: Record<string, number | "denied">, allowed: string[]) =>
    Object.entries(seen).filter(([rel, n]) => n !== "denied" && n > 0 && !allowed.includes(rel)).map(([rel, n]) => `${rel}: ${n} rows`);

  it("the public anon key reads nothing but reference data", async () => {
    expect(leaks(await visible("anon", null), PUBLIC_REFERENCE)).toEqual([]);
  });

  it("a signed-in user's token reads nothing from another organisation", async () => {
    expect(leaks(await visible("authenticated", ORG_B), PUBLIC_REFERENCE)).toEqual([]);
  });

  it("a signed-in user's token reads their organisation's board data, and never server-only tables", async () => {
    const seen = await visible("authenticated", DEFAULT_ORG_ID);
    expect(seen.referrals).toBeGreaterThan(0); // the policies work, they don't just deny everything
    expect(seen.call_attempts).toBeGreaterThan(0);
    const serverOnly = ["patient_details", "messages", "bolna_webhook_log", "app_users", "app_settings", "login_failures",
      "organisations", "haazir_migrations", "intake_drafts", "test_matrix_results"];
    expect(serverOnly.filter((t) => seen[t] !== "denied" && (seen[t] as number) > 0)).toEqual([]);
  });

  it("neither role can write, delete or truncate anything", async () => {
    const counts = async () => JSON.stringify(await sb.query(
      `select (select count(*) from referrals) r, (select count(*) from organisations) o, (select count(*) from haazir_migrations) m,
              (select count(*) from facilities) f, (select string_agg(status, ',') from referrals) s`));
    const before = await counts();
    for (const [role, org] of [["anon", null], ["authenticated", DEFAULT_ORG_ID]] as const) {
      for (const sql of [
        `update referrals set status = 'cancelled'`,
        `delete from facilities`,
        `insert into organisations (name) values ('evil')`,
        `delete from haazir_migrations`,
        `update organisations set name = 'evil'`,
        `truncate events`,
        `select next_referral_code()`,
      ]) {
        await as(role, org, () => sb.query(sql));
      }
    }
    expect(await counts()).toBe(before);
    expect(await sb.query(`select count(*)::int as n from events`)).toEqual([{ n: expect.any(Number) }]);
    expect((await sb.query<{ n: number }>(`select count(*)::int as n from events`))[0].n).toBeGreaterThan(0);
  });

  it("the public anon key can't call database functions", async () => {
    expect(await as("anon", null, () => sb.query(`select next_referral_code()`))).toBe("denied");
  });
});
