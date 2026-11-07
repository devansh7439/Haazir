import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import type { DeskCallRow, DeskFacility } from "@/lib/modules/hospital/hospital.type";

/** A hospital's private desk link and what its screen reads (`facility_desk_links`, `facilities.full_until`). */
export const HospitalRepository = {
  /** The hospital whose link has this token hash, or null. */
  byTokenHash: (hash: string): Promise<DeskFacility | null> =>
    one<DeskFacility>(
      `select f.id as facility_id, f.org_id, f.name, f.full_until
       from facility_desk_links l join facilities f on f.id = l.facility_id
       where l.token_hash = $1 and f.active`,
      [hash],
    ),

  /** Creates the hospital's link, or replaces it (the old link stops working). */
  upsertLink: async (facilityId: string, orgId: string, hash: string): Promise<void> => {
    await q(
      `insert into facility_desk_links (facility_id, org_id, token_hash, created_at) values ($1, $2, $3, $4)
       on conflict (facility_id) do update set token_hash = excluded.token_hash, created_at = excluded.created_at`,
      [facilityId, orgId, hash, now()],
    );
  },

  /** Whether the hospital has a desk-screen link. */
  hasLink: async (facilityId: string): Promise<boolean> =>
    !!(await one(`select 1 from facility_desk_links where facility_id = $1`, [facilityId])),

  /** Marks the hospital full until `until`; null clears it. */
  setFullUntil: async (facilityId: string, until: Date | null): Promise<void> => {
    await q(`update facilities set full_until = $2 where id = $1`, [facilityId, until]);
  },

  /** The availability calls this hospital took since `since`, newest first, with their referral's de-identified summary. */
  recentCalls: (facilityId: string, since: Date): Promise<DeskCallRow[]> =>
    q<DeskCallRow>(
      `select r.code, r.status as referral_status, r.selected_facility_id, r.hold_expires_at, r.treatment_started_at,
              r.spoken_summary as summary,
              d.name as doctor_name, o.name as origin_name,
              a.outcome, a.status, a.eta_minutes, a.created_at
       from call_attempts a
       join referrals r on r.id = a.referral_id
       left join referrers d on d.id = r.referrer_id
       left join facilities o on o.id = r.origin_facility_id
       where a.facility_id = $1 and a.purpose = 'availability' and a.created_at >= $2 and r.status <> 'draft'
       order by a.created_at desc
       limit 20`,
      [facilityId, since],
    ),

  /** Whether this hospital already told the doctor it can't take the patient. */
  hasWithdrawn: async (referralId: string, facilityId: string): Promise<boolean> =>
    !!(await one(
      `select 1 from events where referral_id = $1 and type = 'alert'
         and payload->>'kind' = 'hospital_withdrew' and payload->>'facility_id' = $2`,
      [referralId, facilityId],
    )),
};
