import "server-only";
import { q } from "@/lib/core/db";
import type { EventRow } from "@/lib/core/types";
import type { AttemptView, ReferralListItem } from "@/lib/modules/referral/view.type";

/** How many events the board loads: the newest ones. */
const EVENT_LIMIT = 200;

/** The reads behind the live board and the Referrals list. */
export const ViewRepository = {
  /** A referral's calls with their hospital and number, oldest first. */
  attempts: (referralId: string): Promise<AttemptView[]> =>
    q<AttemptView>(
      `select a.*, f.name as facility_name, f.lat as facility_lat, f.lng as facility_lng,
              c.role as contact_role, c.is_ivr as contact_is_ivr
       from call_attempts a
       left join facilities f on f.id = a.facility_id
       left join facility_contacts c on c.id = a.contact_id
       where a.referral_id = $1
       order by a.created_at, a.rank nulls last`,
      [referralId],
    ),

  /** A referral's newest events, newest first. */
  recentEvents: (referralId: string): Promise<EventRow[]> =>
    q<EventRow>(`select * from events where referral_id = $1 order by created_at desc, id desc limit ${EVENT_LIMIT}`, [referralId]),

  /** An organisation's referrals, newest first, without Demo-page test calls. */
  list: (orgId: string, limit: number): Promise<Array<Omit<ReferralListItem, "created_at"> & { created_at: Date }>> =>
    q(
      `select r.id, r.code, r.status, t.label as case_label, r.acuity, r.is_simulated, r.created_at, r.close_reason,
              m.ttfa_seconds, m.time_to_confirmed_seconds, m.calls_total::int as calls_total
       from referrals r
       join case_templates t on t.case_type = r.case_type
       join referral_metrics m on m.id = r.id
       where r.org_id = $2 and coalesce(r.close_reason, '') <> 'test_call'
       order by r.created_at desc
       limit $1`,
      [limit, orgId],
    ),
};
