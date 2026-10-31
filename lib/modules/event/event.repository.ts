import "server-only";
import { now } from "@/lib/core/clock";
import { json, q } from "@/lib/core/db";

/** Event types covered by events_once_per_referral_idx (migration 0002): a second insert is ignored. */
export type OnceEventType = "hold_expired" | "options_ready" | "referral_exhausted";

type Payload = Record<string, unknown>;

/** The append-only audit log behind the live board. Payloads never hold patient identifiers (CLAUDE.md rule 1). */
export const EventRepository = {
  add: async (referralId: string, type: string, payload: Payload = {}, attemptId: string | null = null): Promise<void> => {
    await q(
      `insert into events (referral_id, attempt_id, type, payload, created_at) values ($1, $2, $3, $4::jsonb, $5)`,
      [referralId, attemptId, type, json(payload), now()],
    );
  },

  /** Adds a once-only event. False when the referral already has one. */
  addOnce: async (referralId: string, type: OnceEventType, payload: Payload = {}, attemptId: string | null = null): Promise<boolean> => {
    const rows = await q(
      `insert into events (referral_id, attempt_id, type, payload, created_at) values ($1, $2, $3, $4::jsonb, $5)
       on conflict do nothing returning id`,
      [referralId, attemptId, type, json(payload), now()],
    );
    return rows.length > 0;
  },
};
