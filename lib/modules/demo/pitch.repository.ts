import "server-only";
import { one } from "@/lib/core/db";

/** Real (non-simulated) results of an organisation: referrals that got a yes, time to first yes, and answered calls. */
export interface MeasuredRow {
  n: number;
  median: number | null;
  latest: number | null;
  calls: number;
  answered: number;
}

/** The measured numbers the run sheet may quote. */
export const PitchRepository = {
  measured: (orgId: string): Promise<MeasuredRow | null> =>
    one<MeasuredRow>(
      `select
         (select count(*)::int from referral_metrics m join referrals r on r.id = m.id
           where r.org_id = $1 and not r.is_simulated and m.ttfa_seconds is not null) as n,
         (select percentile_cont(0.5) within group (order by m.ttfa_seconds) from referral_metrics m join referrals r on r.id = m.id
           where r.org_id = $1 and not r.is_simulated and m.ttfa_seconds is not null) as median,
         (select m.ttfa_seconds from referral_metrics m join referrals r on r.id = m.id
           where r.org_id = $1 and not r.is_simulated and m.ttfa_seconds is not null order by r.created_at desc limit 1) as latest,
         (select count(*)::int from call_attempts a join referrals r on r.id = a.referral_id
           where r.org_id = $1 and not r.is_simulated and a.purpose = 'availability' and a.status in ('completed','no_answer','busy')) as calls,
         (select count(*)::int from call_attempts a join referrals r on r.id = a.referral_id
           where r.org_id = $1 and not r.is_simulated and a.purpose = 'availability' and a.answered_at is not null) as answered`,
      [orgId],
    ),
};
