import "server-only";
import { getDb, one, q, readSql } from "@/lib/core/db";
import { now } from "@/lib/core/clock";
import type { Referral } from "@/lib/core/types";

/** The referring centre in the seed; the Demo page lists every other demo hospital. */
const DEMO_ORIGIN_ID = "00000000-0000-4000-8000-000000000100";

/** A demo hospital with its best number (non-IVR first, then by priority). */
export interface DemoFacilityRow {
  id: string;
  name: string;
  call_language: string;
  whatsapp_number: string | null;
  contact_id: string | null;
  phone: string | null;
}

/** The columns of the closed carrier referral a test call is attached to. */
export interface TestCallReferral {
  referrer_id: string;
  case_type: string;
  acuity: string;
  age_value: number | null | undefined;
  age_unit: string | undefined;
  sex: string | undefined;
  note: string | null | undefined;
  required_capabilities: string[];
  spoken_summary: string;
  is_simulated: boolean;
}

/** The fictional demo directory (`is_demo` rows) behind the Demo page (docs/04-api-spec.md §2.12). */
export const DemoRepository = {
  /** Deletes every demo referral (their calls, events and messages cascade). Returns how many. */
  deleteReferrals: async (): Promise<number> => (await q(`delete from referrals where is_demo returning id`)).length,

  /** Drops numbers added from redirects during runs; numbers assigned on the Demo page are kept. */
  dropRedirectContacts: async (): Promise<void> => {
    await q(
      `delete from facility_contacts c using facilities f
       where c.facility_id = f.id and f.is_demo and c.role = 'other' and c.verified_at is null and c.priority = 9`,
    );
  },

  /** Clears the demo desks' answer rates, which feed the ranking. */
  resetContactStats: async (): Promise<void> => {
    await q(
      `update facility_contacts c set calls_made = 0, calls_answered = 0, last_outcome = null
       from facilities f where c.facility_id = f.id and f.is_demo`,
    );
  },

  /** Re-applies the seed. Idempotent: restores anything a run removed. */
  reseed: async (): Promise<void> => {
    await (await getDb()).exec(readSql("supabase/seed.sql"));
  },

  /** Every demo hospital except the referring centre, by name. */
  facilities: (): Promise<DemoFacilityRow[]> =>
    q<DemoFacilityRow>(
      `select f.id, f.name, f.call_language, f.whatsapp_number, c.id as contact_id, c.phone_e164 as phone
       from facilities f
       left join lateral (
         select id, phone_e164 from facility_contacts
         where facility_id = f.id and active order by is_ivr, priority limit 1
       ) c on true
       where f.is_demo and f.id <> '${DEMO_ORIGIN_ID}'
       order by f.name`,
    ),

  /** A hospital's best active number (non-IVR first, then by priority), or null. */
  primaryContact: (facilityId: string): Promise<{ id: string; phone_e164: string } | null> =>
    one<{ id: string; phone_e164: string }>(
      `select id, phone_e164 from facility_contacts where facility_id = $1 and active order by is_ivr, priority limit 1`,
      [facilityId],
    ),

  /** Gives a contact a new number, first freeing it if another number row of the same hospital has it. */
  reassignContactPhone: async (facilityId: string, contactId: string, phone: string): Promise<void> => {
    await q(`delete from facility_contacts where facility_id = $1 and phone_e164 = $2 and id <> $3`, [facilityId, phone, contactId]);
    await q(`update facility_contacts set phone_e164 = $2, verified_at = $3 where id = $1`, [contactId, phone, now()]);
  },

  referrerPhone: async (referrerId: string): Promise<string | null> =>
    (await one<{ phone_e164: string }>(`select phone_e164 from referrers where id = $1`, [referrerId]))?.phone_e164 ?? null,

  setReferrerPhone: async (referrerId: string, phone: string): Promise<void> => {
    await q(`update referrers set phone_e164 = $2 where id = $1`, [referrerId, phone]);
  },

  /**
   * Inserts the closed carrier referral a test call hangs off, at the referrer's own centre. Closed with reason
   * `test_call`, so evaluation ignores it and a test call never opens waves or holds. Null when the referrer has no centre.
   */
  insertTestCallReferral: (r: TestCallReferral): Promise<Referral | null> => {
    const t = now();
    return one<Referral>(
      `insert into referrals (status, referrer_id, origin_facility_id, origin_lat, origin_lng, case_type, acuity, age_value,
         age_unit, sex, note, required_capabilities, spoken_summary, transport, is_simulated, is_demo, closed_at, close_reason,
         created_at, updated_at)
       select 'closed', r.id, r.facility_id, f.lat, f.lng, $2, $3, $4, $5, $6, $7, $8::text[],
              $11, 'ambulance', $9, true, $10, 'test_call', $10, $10
       from referrers r join facilities f on f.id = r.facility_id where r.id = $1
       returning *`,
      [
        r.referrer_id,
        r.case_type,
        r.acuity,
        r.age_value,
        r.age_unit,
        r.sex,
        r.note,
        r.required_capabilities,
        r.is_simulated,
        t,
        r.spoken_summary,
      ],
    );
  },
};
