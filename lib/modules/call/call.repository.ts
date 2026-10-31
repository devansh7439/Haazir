import "server-only";
import { now } from "@/lib/core/clock";
import { json, one, q, setClause } from "@/lib/core/db";
import type { Attempt, AttemptStatus, Outcome, Purpose } from "@/lib/core/types";
import type { NewAttempt, OutcomeSource } from "@/lib/modules/call/call.type";

const OPEN_STATUSES = "('queued','dialing','ringing','in_progress','wrapping_up')";


/** What a hospital answered on an availability call, from record_hospital_response. */
export interface AvailabilityAnswer {
  outcome: Outcome;
  source: OutcomeSource;
  bed_type: string | null;
  specialist_available: string | null;
  ready_in_minutes: number | null;
  contact_person: string | null;
  conditions: string | null;
  decline_reason: string | null;
  alternate_number: string | null;
  needs_review: boolean;
}

/** Call attempts (`call_attempts`): one row per phone call Haazir places. Every write stamps `updated_at` from the clock. */
export const CallRepository = {
  get: (id: string): Promise<Attempt | null> => one<Attempt>(`select * from call_attempts where id = $1`, [id]),

  /** A referral's calls, oldest first. */
  listForReferral: (referralId: string): Promise<Attempt[]> =>
    q<Attempt>(`select * from call_attempts where referral_id = $1 order by created_at, rank nulls last`, [referralId]),

  findByExecution: (executionId: string): Promise<Attempt | null> =>
    one<Attempt>(`select * from call_attempts where bolna_execution_id = $1`, [executionId]),

  /** Fallback when attempt_id didn't come through: the latest call still open to that number. */
  findOpenByNumber: (toNumber: string, purposes: Purpose[]): Promise<Attempt | null> =>
    one<Attempt>(
      `select * from call_attempts
       where to_number = $1 and purpose = any($2::text[])
         and status not in ('completed','no_answer','busy','failed','canceled')
       order by created_at desc limit 1`,
      [toNumber, purposes],
    ),

  /** Inserts a queued call. Null when a unique guard (one redial or one release per parent) says it already exists. */
  insert: async (a: NewAttempt): Promise<Attempt | null> => {
    const t = now();
    return one<Attempt>(
      `insert into call_attempts
         (referral_id, facility_id, contact_id, parent_attempt_id, purpose, wave, rank, distance_km, eta_minutes,
          rank_reasons, to_number, call_language, status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, 'queued', $13, $13)
       on conflict do nothing
       returning *`,
      [
        a.referral_id,
        a.facility_id ?? null,
        a.contact_id ?? null,
        a.parent_attempt_id ?? null,
        a.purpose,
        a.wave ?? 1,
        a.rank ?? null,
        a.distance_km ?? null,
        a.eta_minutes ?? null,
        json(a.rank_reasons ?? []),
        a.to_number,
        a.call_language,
        t,
      ],
    );
  },

  /** Updates a call; `where` adds compare-and-set conditions (e.g. { status: "ringing" }). Null when they don't hold. */
  update: async (id: string, fields: Partial<Attempt>, where: Record<string, unknown> = {}): Promise<Attempt | null> => {
    const set = setClause({ ...fields, updated_at: now() }, 2);
    const conds: string[] = [];
    const values: unknown[] = [id, ...set.values];
    for (const [k, v] of Object.entries(where)) {
      if (v === null) conds.push(`${k} is null`);
      else {
        values.push(v);
        conds.push(`${k} = $${values.length}`);
      }
    }
    return one<Attempt>(`update call_attempts set ${set.sql} where id = $1${conds.map((c) => ` and ${c}`).join("")} returning *`, values);
  },

  /** Moves a call to `to` only if its status is still the one we read. Null when another writer got there first. */
  casStatus: (attempt: Attempt, to: AttemptStatus, fields: Partial<Attempt> = {}): Promise<Attempt | null> =>
    CallRepository.update(attempt.id, { ...fields, status: to }, { status: attempt.status }),

  /** Records an availability answer. Null when the call already has this outcome, so a repeated function call changes nothing. */
  recordAvailability: (id: string, a: AvailabilityAnswer): Promise<Attempt | null> =>
    one<Attempt>(
      `update call_attempts set
         outcome = $2, outcome_source = $3, bed_type = $4, specialist_available = $5, ready_in_minutes = $6,
         contact_person = $7, conditions = $8, decline_reason = $9, alternate_number = $10,
         outcome_at = $11, answered_at = coalesce(answered_at, $11), updated_at = $11, needs_review = $12
       where id = $1 and outcome is distinct from $2
       returning *`,
      [
        id,
        a.outcome,
        a.source,
        a.bed_type,
        a.specialist_available,
        a.ready_in_minutes,
        a.contact_person,
        a.conditions,
        a.decline_reason,
        a.alternate_number,
        now(),
        a.needs_review,
      ],
    ),

  /** The desk asked for the doctor. Null when already recorded. */
  recordNeedsDoctor: (id: string, source: OutcomeSource, contactPerson: string | null, reason: string | null): Promise<Attempt | null> =>
    one<Attempt>(
      `update call_attempts set outcome = 'needs_doctor', outcome_source = $2, contact_person = coalesce($3, contact_person),
         conditions = $4, outcome_at = $5, answered_at = coalesce(answered_at, $5), updated_at = $5
       where id = $1 and outcome is distinct from 'needs_doctor' returning *`,
      [id, source, contactPerson, reason, now()],
    ),

  /** The desk asked to be called back at `due`. Null when already recorded. */
  recordCallback: (id: string, source: OutcomeSource, due: Date, contactPerson: string | null): Promise<Attempt | null> =>
    one<Attempt>(
      `update call_attempts set outcome = 'callback_later', outcome_source = $2, callback_due_at = $3,
         contact_person = coalesce($4, contact_person), outcome_at = $5, answered_at = coalesce(answered_at, $5), updated_at = $5
       where id = $1 and outcome is distinct from 'callback_later' returning *`,
      [id, source, due, contactPerson, now()],
    ),

  /** Records a hold call's yes or no. Null when the call already has this outcome. */
  recordHoldOutcome: (
    id: string,
    outcome: "hold_confirmed" | "hold_declined",
    source: OutcomeSource,
    contactPerson: string | null,
    notes: string | null,
  ): Promise<Attempt | null> =>
    one<Attempt>(
      `update call_attempts set outcome = $2, outcome_source = $3, contact_person = coalesce($4, contact_person),
         conditions = coalesce($5, conditions), outcome_at = $6, answered_at = coalesce(answered_at, $6), updated_at = $6
       where id = $1 and outcome is distinct from $2 returning *`,
      [id, outcome, source, contactPerson, notes, now()],
    ),

  /** How many times this hospital was redialed or called back for this referral. */
  countRedials: async (referralId: string, facilityId: string | null): Promise<number> => {
    const row = await one<{ n: number }>(
      `select count(*)::int as n from call_attempts
       where referral_id = $1 and facility_id is not distinct from $2 and purpose = 'availability' and parent_attempt_id is not null`,
      [referralId, facilityId],
    );
    return row?.n ?? 0;
  },

  /** The latest call to a number since `since`, with the hospital's name: who a missed inbound call is about. */
  latestToNumber: (toNumber: string, since: Date): Promise<{ referral_id: string; name: string | null } | null> =>
    one<{ referral_id: string; name: string | null }>(
      `select a.referral_id, f.name from call_attempts a left join facilities f on f.id = a.facility_id
       where a.to_number = $1 and a.created_at > $2 order by a.created_at desc limit 1`,
      [toNumber, since],
    ),

  /** The hold call that confirmed the bed, if any. */
  latestConfirmedHold: (referralId: string): Promise<Attempt | null> =>
    one<Attempt>(
      `select * from call_attempts where referral_id = $1 and purpose = 'hold_confirm' and outcome = 'hold_confirmed'
       order by created_at desc limit 1`,
      [referralId],
    ),

  hasFamilyCallSince: async (referralId: string, since: Date): Promise<boolean> =>
    !!(await one(
      `select 1 from call_attempts where referral_id = $1 and purpose = 'family_update' and created_at > $2`,
      [referralId, since],
    )),

  /** Real calls still open and not polled since `polledBefore`: candidates for missed-webhook recovery. At most 50. */
  staleCandidates: (referralId: string | null, polledBefore: Date): Promise<Attempt[]> =>
    q<Attempt>(
      `select * from call_attempts
       where status in ${OPEN_STATUSES}
         and bolna_execution_id is not null
         and bolna_execution_id not like 'sim\_%'
         and ($1::uuid is null or referral_id = $1)
         and (last_polled_at is null or last_polled_at < $2)
       order by updated_at limit 50`,
      [referralId, polledBefore],
    ),

  /** Claims a poll so concurrent ticks don't both ask Bolna. False when another tick claimed it. */
  claimPoll: async (attempt: Attempt, at: Date): Promise<boolean> =>
    !!(await one(
      `update call_attempts set last_polled_at = $2 where id = $1 and last_polled_at is not distinct from $3 returning id`,
      [attempt.id, at, attempt.last_polled_at],
    )),

  /** Counts a finished call toward the desk's answer rate, which feeds the ranking. */
  bumpContactStats: async (contactId: string | null, answered: boolean, lastOutcome: string | null): Promise<void> => {
    if (!contactId) return;
    await q(
      `update facility_contacts
       set calls_made = calls_made + 1,
           calls_answered = calls_answered + $2::int,
           last_outcome = coalesce($3, last_outcome)
       where id = $1`,
      [contactId, answered ? 1 : 0, lastOutcome],
    );
  },
};
