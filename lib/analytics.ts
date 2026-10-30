import "server-only";
import { TIMEZONE } from "@/lib/core/config";
import { q } from "@/lib/core/db";

// C5: acceptance analytics per hospital and per hour of day (IST). Availability calls only.

export interface HospitalStat {
  facility_id: string;
  name: string;
  calls: number;
  answered: number;
  accepted: number;
  median_answer_s: number | null;
  mismatches: number;
  last_called_at: string | null;
}

export interface HourStat {
  hour: number;
  calls: number;
  answered: number;
  accepted: number;
}

export async function hospitalStats(orgId: string, includeSimulated: boolean): Promise<HospitalStat[]> {
  const rows = await q<HospitalStat & { last_called_at: Date | null }>(
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
  );
  return rows.map((r) => ({ ...r, last_called_at: r.last_called_at ? new Date(r.last_called_at).toISOString() : null }));
}

export async function hourStats(orgId: string, includeSimulated: boolean): Promise<HourStat[]> {
  const rows = await q<HourStat>(
    `select extract(hour from a.created_at at time zone '${TIMEZONE}')::int as hour,
            count(*)::int as calls,
            count(*) filter (where a.answered_at is not null)::int as answered,
            count(*) filter (where a.outcome in ('accepted','conditional'))::int as accepted
     from call_attempts a join referrals r on r.id = a.referral_id
     where a.org_id = $1 and a.purpose = 'availability' and ($2 or not r.is_simulated)
     group by 1`,
    [orgId, includeSimulated],
  );
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  return Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? { hour, calls: 0, answered: 0, accepted: 0 });
}
