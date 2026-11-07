import "server-only";
import { now } from "@/lib/core/clock";
import { json, one, q } from "@/lib/core/db";
import type { EventType } from "@/lib/core/types";

/** Event types covered by events_once_per_referral_idx (migration 0002): a second insert is ignored. */
export type OnceEventType = Extract<EventType, "hold_expired" | "options_ready" | "referral_exhausted">;

type Payload = Record<string, unknown>;

/** The append-only audit log behind the live board. Payloads never hold patient identifiers (CLAUDE.md rule 1). */
export const EventRepository = {
  /** Appends one event to the referral's log. */
  add: async (referralId: string, type: EventType, payload: Payload = {}, attemptId: string | null = null): Promise<void> => {
    await q(
      `insert into events (referral_id, attempt_id, type, payload, created_at) values ($1, $2, $3, $4::jsonb, $5)`,
      [referralId, attemptId, type, json(payload), now()],
    );
  },

  /** Whether a call already has an event of this type. */
  existsForAttempt: async (attemptId: string, type: EventType): Promise<boolean> =>
    !!(await one(`select 1 from events where attempt_id = $1 and type = $2`, [attemptId, type])),

  /** Adds a once-only event. False when the referral already has one. */
  addOnce: async (
    referralId: string,
    type: OnceEventType,
    payload: Payload = {},
    attemptId: string | null = null,
  ): Promise<boolean> => {
    const rows = await q(
      `insert into events (referral_id, attempt_id, type, payload, created_at) values ($1, $2, $3, $4::jsonb, $5)
       on conflict do nothing returning id`,
      [referralId, attemptId, type, json(payload), now()],
    );
    return rows.length > 0;
  },
};
