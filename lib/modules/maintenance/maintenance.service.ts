import "server-only";
import { env } from "@/lib/core/config";
import { now } from "@/lib/core/clock";
import { createLogger } from "@/lib/core/logger";
import { WebhookService } from "@/lib/modules/call/webhook.service";
import { advanceSimulation } from "@/lib/modules/demo/simulator.service";
import { MaintenanceRepository } from "@/lib/modules/maintenance/maintenance.repository";
import type { PurgeResult } from "@/lib/modules/maintenance/maintenance.type";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { SettingRepository } from "@/lib/modules/setting/setting.repository";

const log = createLogger("maintenance");

const PURGE_KEY = "last_purge_at";
const HOUR_MS = 3600_000;
/** Referrals older than this are left alone by the background loop. */
const ACTIVE_WINDOW_MS = 24 * HOUR_MS;

/**
 * Work that must happen even when no console is open: next waves, callbacks, hold expiry, missed-webhook recovery
 * and the retention purge. Run by /api/cron/tick (Supabase pg_cron or a Vercel cron).
 */
export const MaintenanceService = {
  /** Referrals from the last 24 h that can still change on their own. */
  activeReferrals: (): Promise<Array<{ id: string; is_simulated: boolean }>> =>
    MaintenanceRepository.activeReferrals(new Date(now().getTime() - ACTIVE_WINDOW_MS)),

  /**
   * Deletes identifying data once a referral has been closed or cancelled for `days` days (docs/03-data-model.md §7).
   * De-identified referrals, calls and events stay for analytics.
   */
  purgeIdentifiers: (days = env.retentionDays): Promise<PurgeResult> =>
    MaintenanceRepository.purgeBefore(new Date(now().getTime() - days * 24 * HOUR_MS)),

  /** One background tick. One referral failing never stops the others. The purge runs at most hourly. */
  tick: async (): Promise<{ referrals: number; recovered: number; actions: number; purged: PurgeResult | null }> => {
    const recovered = await WebhookService.recoverStale();
    const referrals = await MaintenanceService.activeReferrals();
    let actions = 0;
    for (const r of referrals) {
      try {
        if (r.is_simulated) actions += await advanceSimulation(r.id);
        actions += (await EvaluationService.evaluate(r.id)).length;
      } catch (err) {
        log.error({ err, referralId: r.id }, "Cron evaluate failed");
      }
    }
    let purged: PurgeResult | null = null;
    const last = await SettingRepository.get(PURGE_KEY);
    if (!last || now().getTime() - new Date(last).getTime() > HOUR_MS) {
      purged = await MaintenanceService.purgeIdentifiers();
      await SettingRepository.set(PURGE_KEY, now().toISOString());
    }
    return { referrals: referrals.length, recovered, actions, purged };
  },
};
