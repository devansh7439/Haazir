import "server-only";
import { q } from "@/lib/core/db";
import type { PurgeResult } from "@/lib/modules/maintenance/maintenance.type";

/** Referrals closed or cancelled before $1: their identifying data is due for deletion. */
const ENDED_BEFORE = `select id from referrals where status in ('closed','cancelled') and coalesce(closed_at, updated_at) < $1`;

/** The background loop's reads and the retention purge (docs/03-data-model.md §7). */
export const MaintenanceRepository = {
  /** Referrals created after `since` that can still change on their own: open ones, and cancelled ones with calls still live. */
  activeReferrals: (since: Date): Promise<Array<{ id: string; is_simulated: boolean }>> =>
    q<{ id: string; is_simulated: boolean }>(
      `select r.id, r.is_simulated from referrals r
       where r.created_at > $1
         and (r.status in ('searching','options_ready','confirming','confirmed','exhausted')
              or (r.status = 'cancelled' and exists (
                    select 1 from call_attempts a where a.referral_id = r.id
                      and a.status in ('queued','dialing','ringing','in_progress','wrapping_up'))))
       order by r.created_at`,
      [since],
    ),

  /**
   * Deletes patient details and message bodies of referrals that ended before `cutoff`, and drafts and raw webhook
   * payloads older than it. Drafts may hold a voice-note transcript; webhook payloads may hold a family member's name.
   */
  purgeBefore: async (cutoff: Date): Promise<PurgeResult> => {
    const pd = await q(`delete from patient_details where referral_id in (${ENDED_BEFORE}) returning referral_id`, [cutoff]);
    const msg = await q(`delete from messages where referral_id in (${ENDED_BEFORE}) returning id`, [cutoff]);
    const drafts = await q(`delete from intake_drafts where created_at < $1 returning id`, [cutoff]);
    const webhookLog = await q(`delete from bolna_webhook_log where received_at < $1 returning id`, [cutoff]);
    return { patient_details: pd.length, messages: msg.length, intake_drafts: drafts.length, webhook_log: webhookLog.length };
  },
};
