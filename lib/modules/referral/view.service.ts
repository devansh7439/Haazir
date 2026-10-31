import "server-only";
import { TICK_INTERVAL_MS, TICK_INTERVAL_SIM_MS } from "@/lib/core/config";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { alertsOf, messagesOf, portalFlagsOf, withoutFamilyContent } from "@/lib/modules/referral/view.helper";
import { ViewRepository } from "@/lib/modules/referral/view.repository";
import type { ReferralListItem, ReferralView } from "@/lib/modules/referral/view.type";

/** The browser-safe views of referrals (docs/04-api-spec.md §2.3). */
export const ViewService = {
  /** One referral for the live board, or null when it doesn't exist. */
  get: async (id: string): Promise<ReferralView | null> => {
    const referral = await ReferralRepository.get(id);
    if (!referral) return null;
    const ctx = await ReferralRepository.context(referral);
    const [rawAttempts, eventsDesc] = await Promise.all([ViewRepository.attempts(id), ViewRepository.recentEvents(id)]);
    const attempts = withoutFamilyContent(rawAttempts);
    const events = [...eventsDesc].reverse();
    return {
      referral,
      portal_flags: portalFlagsOf(events),
      case_label: ctx.template.label,
      needs: ctx.needs.map((n) => ({ code: n.code, label: n.label })),
      referrer: { name: ctx.referrer.name, facility_name: ctx.origin?.name ?? null },
      origin: { lat: referral.origin_lat, lng: referral.origin_lng, name: ctx.origin?.name ?? null },
      attempts,
      events,
      messages: messagesOf(events),
      alerts: alertsOf(events, attempts),
      tick_interval_ms: referral.is_simulated ? TICK_INTERVAL_SIM_MS : TICK_INTERVAL_MS,
      server_time: new Date().toISOString(),
    };
  },

  /** The organisation's referrals, newest first. */
  list: async (orgId: string, limit = 50): Promise<ReferralListItem[]> =>
    (await ViewRepository.list(orgId, limit)).map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })),
};
