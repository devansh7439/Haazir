import "server-only";
import { now } from "@/lib/core/clock";
import type { Attempt } from "@/lib/core/types";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { portalMismatch } from "@/lib/modules/portal/portal.helper";
import { PortalRepository } from "@/lib/modules/portal/portal.repository";
import type { PortalSnapshot, SnapshotInput } from "@/lib/modules/portal/portal.type";

/** A portal reading older than this is not compared with what the desk says. */
export const PORTAL_FRESH_HOURS = 6;

/**
 * Public bed-portal readings (C4): ingested through POST /api/portal-snapshots, compared with what the desk says
 * on the call, and flagged on the board and in analytics.
 */
export const PortalService = {
  /** Stores the readings for the organisation's hospitals; readings for other hospitals are skipped. Returns how many were stored. */
  addSnapshots: async (orgId: string, items: SnapshotInput[]): Promise<number> => {
    let stored = 0;
    for (const s of items) if (await PortalRepository.insert(orgId, s)) stored++;
    return stored;
  },

  /** Flags, once per call, when a fresh portal reading contradicts the desk's answer. True when it raised a flag. */
  checkMismatch: async (a: Attempt): Promise<boolean> => {
    if (a.purpose !== "availability" || !a.facility_id || !a.outcome) return false;
    const snap = await PortalRepository.latestSince(a.facility_id, new Date(now().getTime() - PORTAL_FRESH_HOURS * 3600_000));
    if (!snap) return false;
    const detail = portalMismatch(a.outcome, a.decline_reason, snap);
    if (!detail) return false;
    if (await EventRepository.existsForAttempt(a.id, "portal_mismatch")) return false;
    await EventRepository.add(a.referral_id, "portal_mismatch", {
      facility_id: a.facility_id,
      desk_outcome: a.outcome,
      detail,
      source: snap.source,
      observed_at: new Date(snap.observed_at).toISOString(),
    }, a.id);
    return true;
  },

  latestSnapshots: (orgId: string): Promise<PortalSnapshot[]> => PortalRepository.latestByFacility(orgId),
};
