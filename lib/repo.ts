import "server-only";
import { now } from "@/lib/core/clock";
import { json, one, q } from "@/lib/core/db";
import type { Attempt, AttemptStatus, Capability, CaseTemplate, Contact, Facility, Referral, Referrer } from "@/lib/core/types";

// Data access shared by the orchestrator, handlers and routes. All writes stamp times from lib/clock.

const JSONB_COLUMNS = new Set(["rank_reasons", "extracted_data", "payload"]);

function setClause(fields: Record<string, unknown>, startIndex: number): { sql: string; values: unknown[] } {
  const keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
  const values: unknown[] = [];
  const parts = keys.map((k, i) => {
    const value = fields[k];
    values.push(JSONB_COLUMNS.has(k) ? json(value) : value);
    return `${k} = $${startIndex + i}${JSONB_COLUMNS.has(k) ? "::jsonb" : ""}`;
  });
  return { sql: parts.join(", "), values };
}

// ---------------------------------------------------------------- reads

export const getReferral = (id: string) => one<Referral>(`select * from referrals where id = $1`, [id]);

export const getReferralByCode = (code: string) => one<Referral>(`select * from referrals where code = $1`, [code]);

export const getAttempts = (referralId: string) =>
  q<Attempt>(`select * from call_attempts where referral_id = $1 order by created_at, rank nulls last`, [referralId]);

export const getAttempt = (id: string) => one<Attempt>(`select * from call_attempts where id = $1`, [id]);

export const findAttemptByExecution = (executionId: string) =>
  one<Attempt>(`select * from call_attempts where bolna_execution_id = $1`, [executionId]);

/** Fallback when attempt_id didn't come through: the latest non-terminal attempt to that number. */
export const findOpenAttemptByNumber = (toNumber: string, purposes: string[]) =>
  one<Attempt>(
    `select * from call_attempts
     where to_number = $1 and purpose = any($2::text[])
       and status not in ('completed','no_answer','busy','failed','canceled')
     order by created_at desc limit 1`,
    [toNumber, purposes],
  );

export const getFacility = (id: string) => one<Facility>(`select * from facilities where id = $1`, [id]);

export const getFacilities = (ids: string[]) =>
  q<Facility>(`select * from facilities where id = any($1::uuid[])`, [ids]);

export async function getContactsByFacility(ids: string[]): Promise<Map<string, Contact[]>> {
  const rows = await q<Contact>(
    `select * from facility_contacts where facility_id = any($1::uuid[]) order by priority, created_at`,
    [ids],
  );
  const map = new Map<string, Contact[]>();
  for (const c of rows) {
    const list = map.get(c.facility_id) ?? [];
    list.push(c);
    map.set(c.facility_id, list);
  }
  return map;
}

export const getContact = (id: string) => one<Contact>(`select * from facility_contacts where id = $1`, [id]);

/** Capabilities in the order the codes were given. */
export async function getCapabilities(codes: string[]): Promise<Capability[]> {
  const rows = await q<Capability>(`select * from capabilities where code = any($1::text[])`, [codes]);
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return codes.map((c) => byCode.get(c)).filter((c): c is Capability => !!c);
}

export const getCaseTemplate = (caseType: string) =>
  one<CaseTemplate>(`select * from case_templates where case_type = $1`, [caseType]);

export const getReferrer = (id: string) => one<Referrer>(`select * from referrers where id = $1`, [id]);

export async function getSetting(key: string): Promise<string | null> {
  const row = await one<{ value: string | null }>(`select value from app_settings where key = $1`, [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  await q(
    `insert into app_settings (key, value, updated_at) values ($1, $2, $3)
     on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now()],
  );
}

// ---------------------------------------------------------------- writes

export type NewAttempt = Pick<Attempt, "referral_id" | "purpose" | "to_number" | "call_language"> &
  Partial<Pick<Attempt,
    "facility_id" | "contact_id" | "parent_attempt_id" | "wave" | "rank" | "distance_km" | "eta_minutes" | "rank_reasons"
  >>;

/** Returns null when a unique guard (one redial / one release per parent) says it already exists. */
export async function insertAttempt(a: NewAttempt): Promise<Attempt | null> {
  const t = now();
  return one<Attempt>(
    `insert into call_attempts
       (referral_id, facility_id, contact_id, parent_attempt_id, purpose, wave, rank, distance_km, eta_minutes,
        rank_reasons, to_number, call_language, status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, 'queued', $13, $13)
     on conflict do nothing
     returning *`,
    [
      a.referral_id, a.facility_id ?? null, a.contact_id ?? null, a.parent_attempt_id ?? null, a.purpose,
      a.wave ?? 1, a.rank ?? null, a.distance_km ?? null, a.eta_minutes ?? null, json(a.rank_reasons ?? []),
      a.to_number, a.call_language, t,
    ],
  );
}

/** Updates an attempt; `where` adds compare-and-set conditions (e.g. { status: 'ringing' }). */
export async function updateAttempt(
  id: string,
  fields: Partial<Attempt>,
  where: Record<string, unknown> = {},
): Promise<Attempt | null> {
  const set = setClause({ ...fields, updated_at: now() } as Record<string, unknown>, 2);
  const conds: string[] = [];
  const values: unknown[] = [id, ...set.values];
  for (const [k, v] of Object.entries(where)) {
    if (v === null) conds.push(`${k} is null`);
    else {
      values.push(v);
      conds.push(`${k} = $${values.length}`);
    }
  }
  return one<Attempt>(
    `update call_attempts set ${set.sql} where id = $1${conds.map((c) => ` and ${c}`).join("")} returning *`,
    values,
  );
}

/** Updates a referral, optionally only when it is in one of `fromStatuses` (compare-and-set). */
export async function updateReferral(
  id: string,
  fields: Partial<Referral>,
  fromStatuses?: string[],
): Promise<Referral | null> {
  const set = setClause({ ...fields, updated_at: now() } as Record<string, unknown>, 2);
  const values: unknown[] = [id, ...set.values];
  let cond = "";
  if (fromStatuses) {
    values.push(fromStatuses);
    cond = ` and status = any($${values.length}::text[])`;
  }
  return one<Referral>(`update referrals set ${set.sql} where id = $1${cond} returning *`, values);
}

export async function casAttemptStatus(
  attempt: Attempt,
  to: AttemptStatus,
  fields: Partial<Attempt> = {},
): Promise<Attempt | null> {
  return updateAttempt(attempt.id, { ...fields, status: to }, { status: attempt.status });
}

export async function bumpContactStats(contactId: string | null, answered: boolean, lastOutcome: string | null) {
  if (!contactId) return;
  await q(
    `update facility_contacts
     set calls_made = calls_made + 1,
         calls_answered = calls_answered + $2::int,
         last_outcome = coalesce($3, last_outcome)
     where id = $1`,
    [contactId, answered ? 1 : 0, lastOutcome],
  );
}

export async function logRaw(executionId: string | null, status: string | null, payload: unknown): Promise<void> {
  await q(
    `insert into bolna_webhook_log (execution_id, status, payload, received_at) values ($1, $2, $3::jsonb, $4)`,
    [executionId, status, json(payload), now()],
  );
}
