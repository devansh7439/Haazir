import "server-only";
import { q } from "@/lib/core/db";
import type { EventRow } from "@/lib/core/types";
import type { AttemptView, QueueItem, ReferralListItem } from "@/lib/modules/referral/view.type";

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

  /**
   * An organisation's referrals that are still live, with how their availability calls stand. Unordered: the helper sorts.
   * A name is shown only when the console user who keyed it in is not the referring doctor.
   */
  queue: (orgId: string): Promise<Array<Omit<QueueItem, "created_at"> & { created_at: Date }>> =>
    q(
      `select r.id, r.code, r.status, t.label as case_label, r.acuity, r.created_at, m.ttfa_seconds,
              rr.name as referrer_name, ln.body as last_note, ln.author_name as last_note_by,
              case when u.id is not null and u.referrer_id is distinct from r.referrer_id then u.name end as entered_by_name,
              count(a.id) filter (
                where a.purpose = 'availability' and a.status in ('queued','dialing','ringing','in_progress','wrapping_up')
              )::int as calls_open,
              count(a.id) filter (where a.purpose = 'availability' and a.outcome is not null)::int as calls_answered,
              count(a.id) filter (where a.purpose = 'availability' and a.outcome in ('accepted','conditional'))::int as calls_accepted,
              count(a.id) filter (where a.purpose = 'availability' and a.outcome = 'needs_doctor')::int as needs_doctor,
              count(a.id) filter (where a.purpose = 'availability' and a.needs_review)::int as needs_review
       from referrals r
       join case_templates t on t.case_type = r.case_type
       join referral_metrics m on m.id = r.id
       join referrers rr on rr.id = r.referrer_id
       left join app_users u on u.id = r.entered_by
       left join lateral (
         select n.body, n.author_name from referral_notes n where n.referral_id = r.id order by n.created_at desc, n.seq desc limit 1
       ) ln on true
       left join call_attempts a on a.referral_id = r.id
       where r.org_id = $1 and r.status in ('searching','options_ready','confirming','confirmed','exhausted')
       group by r.id, t.label, m.ttfa_seconds, rr.name, u.id, u.name, u.referrer_id, ln.body, ln.author_name`,
      [orgId],
    ),

  /** An organisation's referrals, newest first. */
  list: (orgId: string, limit: number): Promise<Array<Omit<ReferralListItem, "created_at"> & { created_at: Date }>> =>
    q(
      `select r.id, r.code, r.status, t.label as case_label, r.acuity, r.created_at, r.close_reason,
              m.ttfa_seconds, m.time_to_confirmed_seconds, m.calls_total::int as calls_total
       from referrals r
       join case_templates t on t.case_type = r.case_type
       join referral_metrics m on m.id = r.id
       where r.org_id = $2
       order by r.created_at desc
       limit $1`,
      [limit, orgId],
    ),
};
