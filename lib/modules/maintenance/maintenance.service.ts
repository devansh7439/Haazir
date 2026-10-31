import "server-only";
import { env } from "@/lib/core/config";
import { now } from "@/lib/core/clock";
import { q } from "@/lib/core/db";
import { advanceSimulation } from "@/lib/modules/demo/simulator.service";
import { createLogger } from "@/lib/core/logger";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { SettingRepository } from "@/lib/modules/setting/setting.repository";
import { WebhookService } from "@/lib/modules/call/webhook.service";

const log = createLogger("maintenance");

// Background work that must happen even when no console is open: next waves, callbacks, hold expiry,
// missed-webhook recovery and the retention purge. Run by /api/cron/tick (Supabase pg_cron or Vercel cron).

/** Referrals that can still change on their own: open ones from the last 24 h, and cancelled ones with calls still live. */
export async function activeReferralIds(): Promise<Array<{ id: string; is_simulated: boolean }>> {
  return q<{ id: string; is_simulated: boolean }>(
    `select r.id, r.is_simulated from referrals r
     where r.created_at > $1
       and (r.status in ('searching','options_ready','confirming','confirmed','exhausted')
            or (r.status = 'cancelled' and exists (
                  select 1 from call_attempts a where a.referral_id = r.id
                    and a.status in ('queued','dialing','ringing','in_progress','wrapping_up'))))
     order by r.created_at`,
    [new Date(now().getTime() - 24 * 3600_000)],
  );
}

export interface PurgeResult {
  patient_details: number;
  messages: number;
  intake_drafts: number;
  webhook_log: number;
}

/**
 * Deletes identifying data once a referral has been closed or cancelled for `days` days (docs/03-data-model.md §7).
 * De-identified referrals, calls and events stay for analytics.
 */
export async function purgeIdentifiers(days = env.retentionDays): Promise<PurgeResult> {
  const cutoff = new Date(now().getTime() - days * 86_400_000);
  const ended = `select id from referrals where status in ('closed','cancelled') and coalesce(closed_at, updated_at) < $1`;
  const pd = await q(`delete from patient_details where referral_id in (${ended}) returning referral_id`, [cutoff]);
  const msg = await q(`delete from messages where referral_id in (${ended}) returning id`, [cutoff]);
  // Drafts may hold a voice-note transcript; webhook payloads may hold a family member's name.
  const drafts = await q(`delete from intake_drafts where created_at < $1 returning id`, [cutoff]);
  const webhookLog = await q(`delete from bolna_webhook_log where received_at < $1 returning id`, [cutoff]);
  return { patient_details: pd.length, messages: msg.length, intake_drafts: drafts.length, webhook_log: webhookLog.length };
}

const PURGE_KEY = "last_purge_at";

export async function runCronTick(): Promise<{ referrals: number; recovered: number; actions: number; purged: PurgeResult | null }> {
  const recovered = await WebhookService.recoverStale();
  const referrals = await activeReferralIds();
  let actions = 0;
  for (const r of referrals) {
    try {
      if (r.is_simulated) actions += await advanceSimulation(r.id);
      actions += (await ReferralService.evaluate(r.id)).length;
    } catch (err) {
      log.error({ err, referralId: r.id }, "Cron evaluate failed");
    }
  }
  // The purge runs at most hourly.
  let purged: PurgeResult | null = null;
  const last = await SettingRepository.get(PURGE_KEY);
  if (!last || now().getTime() - new Date(last).getTime() > 3600_000) {
    purged = await purgeIdentifiers();
    await SettingRepository.set(PURGE_KEY, now().toISOString());
  }
  return { referrals: referrals.length, recovered, actions, purged };
}
