import "server-only";
import { one, q } from "@/lib/core/db";

/** A bed request still open to a hospital: the latest availability call per referral. */
export interface OpenRequest {
  attempt_id: string;
  referral_id: string;
  code: string;
  facility_name: string;
}

/** Who an inbound WhatsApp message is from (C2, C6). */
export const InboundRepository = {
  /** Hospitals that use this number, as their WhatsApp number or an active desk number. */
  facilityIdsForNumber: async (phone: string): Promise<string[]> =>
    (
      await q<{ id: string }>(
        `select id from facilities where whatsapp_number = $1
         union select facility_id as id from facility_contacts where phone_e164 = $1 and active`,
        [phone],
      )
    ).map((r) => r.id),

  /** Requests to these hospitals since `since`, on referrals in `statuses`; only `code`'s when one is given. */
  openRequests: (facilityIds: string[], since: Date, statuses: string[], code: string | null): Promise<OpenRequest[]> =>
    q<OpenRequest>(
      `select distinct on (a.referral_id) a.id as attempt_id, a.referral_id, r.code, f.name as facility_name
       from call_attempts a join referrals r on r.id = a.referral_id join facilities f on f.id = a.facility_id
       where a.purpose = 'availability' and a.facility_id = any($1::uuid[]) and a.created_at > $2
         and r.status = any($3::text[]) and ($4::text is null or r.code = $4)
       order by a.referral_id, a.created_at desc`,
      [facilityIds, since, statuses, code],
    ),

  /** The registered referring doctor with this number (the first, if two share it). */
  referrerByPhone: (phone: string): Promise<{ id: string; org_id: string } | null> =>
    one<{ id: string; org_id: string }>(`select id, org_id from referrers where phone_e164 = $1 order by created_at limit 1`, [phone]),
};
