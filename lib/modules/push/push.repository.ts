import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import type { PushPlatform, PushToken } from "@/lib/modules/push/push.type";

/** Expo push tokens of the mobile app's devices (`push_tokens`). */
export const PushRepository = {
  /** Saves a device's token for this person; a token already saved for someone else moves to them. */
  upsert: async (orgId: string, userId: string | null, token: string, platform: PushPlatform): Promise<void> => {
    await q(
      `insert into push_tokens (org_id, user_id, token, platform, created_at, last_seen_at) values ($1, $2, $3, $4, $5, $5)
       on conflict (token) do update set
         org_id = excluded.org_id, user_id = excluded.user_id, platform = excluded.platform, last_seen_at = excluded.last_seen_at`,
      [orgId, userId, token, platform, now()],
    );
  },

  /** Forgets a device's token, but only one saved in this organisation. Returns whether one was removed. */
  remove: async (orgId: string, token: string): Promise<boolean> =>
    (await q(`delete from push_tokens where org_id = $1 and token = $2 returning id`, [orgId, token])).length > 0,

  /** Forgets tokens Expo says are no longer valid. */
  removeAny: async (tokens: string[]): Promise<void> => {
    if (tokens.length > 0) await q(`delete from push_tokens where token = any($1::text[])`, [tokens]);
  },

  /**
   * The devices to tell about a referral: those of the doctor who made it, and shared-passcode devices (no user), in
   * the referral's organisation.
   */
  forReferral: (orgId: string, referrerId: string): Promise<PushToken[]> =>
    q<PushToken>(
      `select t.token, t.user_id from push_tokens t left join app_users u on u.id = t.user_id
       where t.org_id = $1 and (t.user_id is null or (u.active and u.referrer_id = $2))`,
      [orgId, referrerId],
    ),

  /** Whether the token is saved (for tests and diagnostics). */
  has: async (token: string): Promise<boolean> => !!(await one(`select 1 from push_tokens where token = $1`, [token])),
};
