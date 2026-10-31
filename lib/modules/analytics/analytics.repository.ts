import "server-only";
import { TIMEZONE } from "@/lib/core/config";
import { q } from "@/lib/core/db";
import type { HospitalStat, HourStat } from "@/lib/modules/analytics/analytics.type";

type HospitalRow = Omit<HospitalStat, "last_called_at"> & { last_called_at: Date | null };

/** The Analytics page's figures (C5). Availability calls only; simulated referrals only when asked for. */
export const AnalyticsRepository = {
  /** Per hospital of the organisation, most-called first. */
  hospitals: (orgId: string, includeSimulated: boolean): Promise<HospitalRow[]> =>
    q(
      `select f.id as facility_id, f.name,
              count(a.id)::int as calls,
              count(a.id) filter (where a.answered_at is not null)::int as answered,
              count(a.id) filter (where a.outcome in ('accepted','conditional'))::int as accepted,
              round(percentile_cont(0.5) within group (order by extract(epoch from (a.outcome_at - a.dispatched_at)))
                    filter (where a.outcome_at is not null and a.dispatched_at is not null))::int as median_answer_s,
              (select count(*)::int from events e join referrals r2 on r2.id = e.referral_id
               where e.type = 'portal_mismatch' and (e.payload->>'facility_id')::uuid = f.id and ($2 or not r2.is_simulated)) as mismatches,
              max(a.created_at) as last_called_at
       from facilities f
       left join call_attempts a on a.facility_id = f.id and a.purpose = 'availability'
         and ($2 or not exists (select 1 from referrals r where r.id = a.referral_id and r.is_simulated))
       where f.org_id = $1
       group by f.id, f.name
       order by count(a.id) desc, f.name`,
      [orgId, includeSimulated],
    ),

  /** Per hour of the day in India time; hours with no calls are left out. */
  hours: (orgId: string, includeSimulated: boolean): Promise<HourStat[]> =>
    q<HourStat>(
      `select extract(hour from a.created_at at time zone '${TIMEZONE}')::int as hour,
              count(*)::int as calls,
              count(*) filter (where a.answered_at is not null)::int as answered,
              count(*) filter (where a.outcome in ('accepted','conditional'))::int as accepted
       from call_attempts a join referrals r on r.id = a.referral_id
       where a.org_id = $1 and a.purpose = 'availability' and ($2 or not r.is_simulated)
       group by 1`,
      [orgId, includeSimulated],
    ),
};
