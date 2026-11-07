import "server-only";
import { now } from "@/lib/core/clock";
import { TICK_INTERVAL_MS } from "@/lib/core/config";
import type { Referral } from "@/lib/core/types";
import { EscalationService } from "@/lib/modules/escalation/escalation.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { sortQueue } from "@/lib/modules/referral/queue.helper";
import { alertsOf, messagesOf, portalFlagsOf, showsNearestEd, withoutFamilyContent } from "@/lib/modules/referral/view.helper";
import { ViewRepository } from "@/lib/modules/referral/view.repository";
import type { QueueItem, ReferralListItem, ReferralView } from "@/lib/modules/referral/view.type";

/** The browser-safe views of referrals (docs/04-api-spec.md §2.3). */
export const ViewService = {
  /** One referral for the live board, or null when it doesn't exist. Pass the row when the caller just loaded it. */
  get: async (id: string, known?: Referral): Promise<ReferralView | null> => {
    const referral = known ?? (await ReferralRepository.get(id));
    if (!referral) return null;
    // Independent reads, started together: the board is re-read every couple of seconds.
    const [ctx, rawAttempts, eventsDesc, nearestEd, escalation] = await Promise.all([
      ReferralRepository.context(referral),
      ViewRepository.attempts(id),
      ViewRepository.recentEvents(id),
      showsNearestEd(referral)
        ? FacilityRepository.nearestEmergency({
            lat: referral.origin_lat,
            lng: referral.origin_lng,
            org_id: referral.org_id,
            origin_id: referral.origin_facility_id,
          })
        : Promise.resolve([]),
      referral.status === "exhausted" ? EscalationService.list(referral.org_id) : Promise.resolve([]),
    ]);
    const attempts = withoutFamilyContent(rawAttempts);
    const events = [...eventsDesc].reverse();
    return {
      referral,
      portal_flags: portalFlagsOf(events),
      nearest_ed: nearestEd,
      escalation: escalation.map((c) => ({ label: c.label, phone: c.phone_e164 })),
      case_label: ctx.template.label,
      needs: ctx.needs.map((n) => ({ code: n.code, label: n.label })),
      referrer: { name: ctx.referrer.name, facility_name: ctx.origin?.name ?? null },
      origin: { lat: referral.origin_lat, lng: referral.origin_lng, name: ctx.origin?.name ?? null },
      attempts,
      events,
      messages: messagesOf(events),
      alerts: alertsOf(events, attempts),
      tick_interval_ms: TICK_INTERVAL_MS,
      server_time: now().toISOString(),
    };
  },

  /** The organisation's live referrals in the order a coordinator should work them (see queue.helper.ts). */
  queue: async (orgId: string): Promise<QueueItem[]> =>
    sortQueue((await ViewRepository.queue(orgId)).map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }))),

  /** The organisation's referrals, newest first. */
  list: async (orgId: string, limit = 50): Promise<ReferralListItem[]> =>
    (await ViewRepository.list(orgId, limit)).map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })),
};
