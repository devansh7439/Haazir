import "server-only";
import { TIMEZONE } from "@/lib/core/config";
import { q } from "@/lib/core/db";
import type { HospitalStat, HourStat, ProofStats } from "@/lib/modules/analytics/analytics.type";

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
              (select count(*)::int from call_attempts b
               where b.facility_id = f.id and b.outcome in ('arrival_confirmed','not_arrived')) as arrival_answers,
              (select count(*)::int from call_attempts b
               where b.facility_id = f.id and b.outcome = 'not_arrived') as not_arrived,
              max(a.created_at) as last_called_at
       from facilities f
       left join call_attempts a on a.facility_id = f.id and a.purpose = 'availability'
       where f.org_id = $1
       group by f.id, f.name
       order by count(a.id) desc, f.name`,
      [orgId],
    ),

  /** The proof figures for the organisation; `realOnly` leaves out referrals made from demo hospitals. */
  proof: async (orgId: string, realOnly: boolean): Promise<ProofStats> => {
    const scope = realOnly ? "and r.is_demo = false" : "";
    const [row] = await q<ProofStats>(
      `select
         (select count(*)::int from referrals r where r.org_id = $1 and r.status <> 'draft' ${scope}) as referrals,
         (select count(*)::int from referrals r where r.org_id = $1 and r.confirmed_at is not null ${scope}) as placed,
         (select round(percentile_cont(0.5) within group (order by extract(epoch from (r.first_acceptance_at - r.created_at))))::int
            from referrals r where r.org_id = $1 and r.first_acceptance_at is not null ${scope}) as median_ttfa_s,
         (select round(percentile_cont(0.5) within group (order by extract(epoch from (r.confirmed_at - r.created_at))))::int
            from referrals r where r.org_id = $1 and r.confirmed_at is not null ${scope}) as median_to_bed_s,
         (select round(percentile_cont(0.5) within group (order by extract(epoch from (r.treatment_started_at - r.created_at))))::int
            from referrals r where r.org_id = $1 and r.treatment_started_at is not null ${scope}) as median_to_treatment_s,
         (select count(*)::int from referrals r where r.org_id = $1 and r.treatment_started_at is not null ${scope}) as treated,
         count(a.id) filter (where a.purpose = 'availability')::int as calls,
         count(a.id) filter (where a.purpose = 'availability' and a.answered_at is not null)::int as answered,
         count(a.id) filter (where a.purpose = 'availability' and a.outcome in ('accepted','conditional'))::int as accepted,
         count(a.id) filter (where a.purpose = 'availability' and a.needs_review)::int as needs_review,
         count(a.id) filter (where a.purpose = 'availability' and a.outcome is not null)::int as with_outcome,
         round(percentile_cont(0.5) within group (order by a.duration_s)
               filter (where a.purpose = 'availability' and a.duration_s is not null))::int as median_call_s,
         count(a.id) filter (where a.outcome in ('arrival_confirmed','not_arrived'))::int as arrival_answers,
         count(a.id) filter (where a.outcome = 'not_arrived')::int as not_arrived,
         sum(a.cost) as total_cost
       from referrals r
       left join call_attempts a on a.referral_id = r.id
       where r.org_id = $1 and r.status <> 'draft' ${scope}`,
      [orgId],
    );
    return row;
  },

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
