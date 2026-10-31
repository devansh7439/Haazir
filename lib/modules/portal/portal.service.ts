import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import { portalMismatch } from "@/lib/modules/portal/portal.helper";
import type { Attempt } from "@/lib/core/types";
import { EventRepository } from "@/lib/modules/event/event.repository";

// Public bed-portal readings (C4). Ingested by an admin or a scraper through POST /api/portal-snapshots,
// compared with what the desk says on the call, and flagged on the board and in analytics.

export const PORTAL_FRESH_HOURS = 6;

export interface SnapshotInput {
  facility_id: string;
  source: string;
  icu_beds_free: number | null;
  ventilators_free: number | null;
  observed_at: string | Date;
}

export async function addSnapshots(orgId: string, items: SnapshotInput[]): Promise<number> {
  let n = 0;
  for (const s of items) {
    const ok = await one(
      `insert into portal_snapshots (facility_id, source, icu_beds_free, ventilators_free, observed_at, created_at)
       select id, $2, $3, $4, $5, $6 from facilities where id = $1 and org_id = $7 returning id`,
      [s.facility_id, s.source, s.icu_beds_free, s.ventilators_free, new Date(s.observed_at), now(), orgId],
    );
    if (ok) n++;
  }
  return n;
}

/** Flags (once per call) when a fresh portal reading contradicts the desk's answer. */
export async function checkPortalMismatch(a: Attempt): Promise<boolean> {
  if (a.purpose !== "availability" || !a.facility_id || !a.outcome) return false;
  const snap = await one<{ source: string; icu_beds_free: number | null; ventilators_free: number | null; observed_at: Date }>(
    `select source, icu_beds_free, ventilators_free, observed_at from portal_snapshots
     where facility_id = $1 and observed_at > $2 order by observed_at desc limit 1`,
    [a.facility_id, new Date(now().getTime() - PORTAL_FRESH_HOURS * 3600_000)],
  );
  if (!snap) return false;
  const detail = portalMismatch(a.outcome, a.decline_reason, snap);
  if (!detail) return false;
  const seen = await one(`select 1 from events where attempt_id = $1 and type = 'portal_mismatch'`, [a.id]);
  if (seen) return false;
  await EventRepository.add(a.referral_id, "portal_mismatch", {
    facility_id: a.facility_id,
    desk_outcome: a.outcome,
    detail,
    source: snap.source,
    observed_at: new Date(snap.observed_at).toISOString(),
  }, a.id);
  return true;
}

export async function latestSnapshots(orgId: string) {
  return q<{ facility_id: string; source: string; icu_beds_free: number | null; ventilators_free: number | null; observed_at: Date }>(
    `select distinct on (facility_id) facility_id, source, icu_beds_free, ventilators_free, observed_at
     from portal_snapshots where org_id = $1 order by facility_id, observed_at desc`,
    [orgId],
  );
}
