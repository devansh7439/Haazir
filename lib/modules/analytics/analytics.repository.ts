import "server-only";
import { TIMEZONE } from "@/lib/core/config";
import { q } from "@/lib/core/db";
import type { HospitalStat, HourStat } from "@/lib/modules/analytics/analytics.type";

type HospitalRow = Omit<HospitalStat, "last_called_at"> & { last_called_at: Date | null };

/** The Analytics page's figures (C5). Availability calls only. */
export const AnalyticsRepository = {
  /** Per hospital of the organisation, most-called first. */
  hospitals: (orgId: string): Promise<HospitalRow[]> =>
    q(
      `select f.id as facility_id, f.name,
              count(a.id)::int as calls,
              count(a.id) filter (where a.answered_at is not null)::int as answered,
              count(a.id) filter (where a.outcome in ('accepted','conditional'))::int as accepted,
              round(percentile_cont(0.5) within group (order by extract(epoch from (a.outcome_at - a.dispatched_at)))
                    filter (where a.outcome_at is not null and a.dispatched_at is not null))::int as median_answer_s,
              (select count(*)::int from events e
               where e.type = 'portal_mismatch' and (e.payload->>'facility_id')::uuid = f.id) as mismatches,
              max(a.created_at) as last_called_at
       from facilities f
       left join call_attempts a on a.facility_id = f.id and a.purpose = 'availability'
       where f.org_id = $1
       group by f.id, f.name
       order by count(a.id) desc, f.name`,
      [orgId],
    ),

  /** Per hour of the day in India time; hours with no calls are left out. */
  hours: (orgId: string): Promise<HourStat[]> =>
    q<HourStat>(
      `select extract(hour from a.created_at at time zone '${TIMEZONE}')::int as hour,
              count(*)::int as calls,
              count(*) filter (where a.answered_at is not null)::int as answered,
              count(*) filter (where a.outcome in ('accepted','conditional'))::int as accepted
       from call_attempts a
       where a.org_id = $1 and a.purpose = 'availability'
       group by 1`,
      [orgId],
    ),
};
