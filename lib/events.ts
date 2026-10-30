import "server-only";
import { now } from "@/lib/core/clock";
import { json, q } from "@/lib/core/db";

// Append-only audit log. Payloads must never contain patient identifiers.

export async function addEvent(
  referralId: string,
  type: string,
  payload: Record<string, unknown> = {},
  attemptId: string | null = null,
): Promise<void> {
  await q(
    `insert into events (referral_id, attempt_id, type, payload, created_at) values ($1, $2, $3, $4::jsonb, $5)`,
    [referralId, attemptId, type, json(payload), now()],
  );
}

/** For event types covered by events_once_per_referral_idx: a second insert is silently ignored. */
export async function addEventOnce(
  referralId: string,
  type: "hold_expired" | "options_ready" | "referral_exhausted",
  payload: Record<string, unknown> = {},
  attemptId: string | null = null,
): Promise<boolean> {
  const rows = await q(
    `insert into events (referral_id, attempt_id, type, payload, created_at) values ($1, $2, $3, $4::jsonb, $5)
     on conflict do nothing returning id`,
    [referralId, attemptId, type, json(payload), now()],
  );
  return rows.length > 0;
}
