import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import type { PortalSnapshot, SnapshotInput } from "@/lib/modules/portal/portal.type";

/** Public bed-portal readings (`portal_snapshots`, C4). */
export const PortalRepository = {
  /** Stores a reading for one of the organisation's hospitals. False when the hospital is not in the organisation. */
  insert: async (orgId: string, s: SnapshotInput): Promise<boolean> =>
    !!(await one(
      `insert into portal_snapshots (facility_id, source, icu_beds_free, ventilators_free, observed_at, created_at)
       select id, $2, $3, $4, $5, $6 from facilities where id = $1 and org_id = $7 returning id`,
      [s.facility_id, s.source, s.icu_beds_free, s.ventilators_free, new Date(s.observed_at), now(), orgId],
    )),

  /** A hospital's newest reading taken after `since`, or null. */
  latestSince: (facilityId: string, since: Date): Promise<Omit<PortalSnapshot, "facility_id"> | null> =>
    one<Omit<PortalSnapshot, "facility_id">>(
      `select source, icu_beds_free, ventilators_free, observed_at from portal_snapshots
       where facility_id = $1 and observed_at > $2 order by observed_at desc limit 1`,
      [facilityId, since],
    ),

  /** The newest reading of each of the organisation's hospitals. */
  latestByFacility: (orgId: string): Promise<PortalSnapshot[]> =>
    q<PortalSnapshot>(
      `select distinct on (facility_id) facility_id, source, icu_beds_free, ventilators_free, observed_at
       from portal_snapshots where org_id = $1 order by facility_id, observed_at desc`,
      [orgId],
    ),
};
