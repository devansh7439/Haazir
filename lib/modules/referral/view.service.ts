import "server-only";
import { TICK_INTERVAL_MS } from "@/lib/core/config";
import { EscalationService } from "@/lib/modules/escalation/escalation.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { alertsOf, messagesOf, portalFlagsOf, showsNearestEd, withoutFamilyContent } from "@/lib/modules/referral/view.helper";
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
    const nearestEd = showsNearestEd(referral)
      ? await FacilityRepository.nearestEmergency({ lat: referral.origin_lat, lng: referral.origin_lng, org_id: referral.org_id, origin_id: referral.origin_facility_id })
      : [];
    return {
      referral,
      portal_flags: portalFlagsOf(events),
      nearest_ed: nearestEd,
      escalation: referral.status === "exhausted"
        ? (await EscalationService.list(referral.org_id)).map((c) => ({ label: c.label, phone: c.phone_e164 }))
        : [],
      case_label: ctx.template.label,
      needs: ctx.needs.map((n) => ({ code: n.code, label: n.label })),
      referrer: { name: ctx.referrer.name, facility_name: ctx.origin?.name ?? null },
      origin: { lat: referral.origin_lat, lng: referral.origin_lng, name: ctx.origin?.name ?? null },
      attempts,
      events,
      messages: messagesOf(events),
      alerts: alertsOf(events, attempts),
      tick_interval_ms: TICK_INTERVAL_MS,
      server_time: new Date().toISOString(),
    };
  },

  /** The organisation's referrals, newest first. */
  list: async (orgId: string, limit = 50): Promise<ReferralListItem[]> =>
    (await ViewRepository.list(orgId, limit)).map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() })),
};
