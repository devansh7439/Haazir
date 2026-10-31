import "server-only";
import { now } from "@/lib/core/clock";
import { one, q, setClause } from "@/lib/core/db";
import type { CaseTemplate, Referral, Referrer } from "@/lib/core/types";
import { ApiError } from "@/lib/core/error";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import type { NewReferral, PatientDetails, ReferralCtx } from "@/lib/modules/referral/referral.type";


/** Referrals, the doctor who made each one, case templates, and the server-only patient details. */
export const ReferralRepository = {
  get: (id: string): Promise<Referral | null> => one<Referral>(`select * from referrals where id = $1`, [id]),

  getByCode: (code: string): Promise<Referral | null> => one<Referral>(`select * from referrals where code = $1`, [code]),

  /** The referral an earlier press of "Find a bed" created, if any. */
  findByRequestId: (orgId: string, requestId: string): Promise<Referral | null> =>
    one<Referral>(`select * from referrals where org_id = $1 and client_request_id = $2`, [orgId, requestId]),

  /** Inserts a searching referral. Null when the same client_request_id already created one (a double-click). */
  insert: (r: NewReferral, at: Date): Promise<Referral | null> => {
    return one<Referral>(
      `insert into referrals
         (status, referrer_id, origin_facility_id, origin_lat, origin_lng, case_type, acuity, age_value, age_unit, sex,
          note, required_capabilities, spoken_summary, transport, search_radius_km, is_simulated, is_demo, created_at, updated_at,
          client_request_id)
       values ('searching', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], $12, $13, $14, $15, $16, $17, $17, $18)
       on conflict (org_id, client_request_id) where client_request_id is not null do nothing
       returning *`,
      [
        r.referrer_id,
        r.origin_facility_id,
        r.origin_lat,
        r.origin_lng,
        r.case_type,
        r.acuity,
        r.age_value,
        r.age_unit,
        r.sex,
        r.note,
        r.required_capabilities,
        r.spoken_summary,
        r.transport,
        r.search_radius_km,
        r.is_simulated,
        r.is_demo,
        at,
        r.client_request_id,
      ],
    );
  },

  /** Updates a referral, optionally only while it is in one of `fromStatuses` (compare-and-set). Null when it isn't. */
  update: async (id: string, fields: Partial<Referral>, fromStatuses?: string[]): Promise<Referral | null> => {
    const set = setClause({ ...fields, updated_at: now() }, 2);
    const values: unknown[] = [id, ...set.values];
    let cond = "";
    if (fromStatuses) {
      values.push(fromStatuses);
      cond = ` and status = any($${values.length}::text[])`;
    }
    return one<Referral>(`update referrals set ${set.sql} where id = $1${cond} returning *`, values);
  },

  /** The atomic wave claim (CLAUDE.md rule 5, docs/03-data-model.md §5.4): only one caller can open a given wave. */
  claimWave: (id: string, expectedWave: number): Promise<Referral | null> => {
    const t = now();
    return one<Referral>(
      `update referrals set current_wave = current_wave + 1, wave_started_at = $3, updated_at = $3
       where id = $1 and current_wave = $2 returning *`,
      [id, expectedWave, t],
    );
  },

  /** Sets first_acceptance_at once and moves searching or exhausted to options_ready. Null when already set or the referral ended. */
  setFirstAcceptance: (id: string, at: Date): Promise<Referral | null> =>
    one<Referral>(
      `update referrals set first_acceptance_at = $2, updated_at = $3,
         status = case when status in ('searching','exhausted') then 'options_ready' else status end
       where id = $1 and first_acceptance_at is null and status not in ('cancelled','closed') returning *`,
      [id, at, now()],
    ),

  /** Back to choosing while a hold is being confirmed: clears the selection. Null when the referral moved on. */
  reopenChoice: (id: string): Promise<Referral | null> =>
    ReferralRepository.update(id, { status: "options_ready", selected_attempt_id: null, selected_facility_id: null }, ["confirming"]),

  /** Live referrals of an organisation still placing calls, created after `since`. */
  countActiveLive: async (orgId: string, since: Date): Promise<number> => {
    const [row] = await q<{ n: number }>(
      `select count(*)::int as n from referrals
       where org_id = $1 and not is_simulated and status in ('searching','confirming') and created_at > $2`,
      [orgId, since],
    );
    return row.n;
  },

  /** The referrer, origin hospital, case template and needs every call and message about the referral uses. */
  context: async (referral: Referral): Promise<ReferralCtx> => {
    const [referrer, origin, template, needs] = await Promise.all([
      ReferralRepository.referrer(referral.referrer_id),
      referral.origin_facility_id ? FacilityRepository.get(referral.origin_facility_id) : Promise.resolve(null),
      ReferralRepository.caseTemplate(referral.case_type),
      FacilityRepository.capabilities(referral.required_capabilities),
    ]);
    if (!referrer || !template) throw ApiError.internal("CONTEXT_MISSING", "Referral context is incomplete");
    return { referral, referrer, origin, template, needs };
  },

  referrer: (id: string): Promise<Referrer | null> => one<Referrer>(`select * from referrers where id = $1`, [id]),

  caseTemplate: (caseType: string): Promise<CaseTemplate | null> =>
    one<CaseTemplate>(`select * from case_templates where case_type = $1`, [caseType]),

  /** Stores the identifiers apart from the referral, server-only (CLAUDE.md rule 1). */
  insertPatient: async (referralId: string, p: PatientDetails, at: Date): Promise<void> => {
    await q(
      `insert into patient_details
         (referral_id, patient_name, attendant_name, attendant_phone_e164, attendant_language, attendant_consent_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [referralId, p.patient_name, p.attendant_name, p.attendant_phone_e164, p.attendant_language, p.attendant_consent_at, at],
    );
  },

  /** The patient and attendant, or null when the doctor gave none. */
  patient: (referralId: string): Promise<PatientDetails | null> =>
    one<PatientDetails>(
      `select patient_name, attendant_name, attendant_phone_e164, attendant_language, attendant_consent_at
       from patient_details where referral_id = $1`,
      [referralId],
    ),

  markSharedWithFacility: async (referralId: string): Promise<void> => {
    await q(`update patient_details set shared_with_facility_at = $2 where referral_id = $1`, [referralId, now()]);
  },

  /** Whether the pre-arrival note has already gone to the receiving hospital. */
  hasHandoff: async (referralId: string): Promise<boolean> =>
    !!(await one(`select 1 from messages where referral_id = $1 and audience = 'receiving_facility'`, [referralId])),

  /** Every case template for the form, "Other" last. */
  caseTemplates: (): Promise<CaseTemplate[]> =>
    q<CaseTemplate>(`select * from case_templates order by case when case_type = 'other' then 1 else 0 end, label`),

  /**
   * The doctor a session refers as: their own referrer when the user is linked to one, else the organisation's first.
   * With their centre's name, for the header.
   */
  defaultReferrer: (orgId: string, referrerId: string | null): Promise<{ id: string; name: string; facility: string | null } | null> =>
    one(
      `select r.id, r.name, f.name as facility from referrers r left join facilities f on f.id = r.facility_id
       where r.org_id = $1 and ($2::uuid is null or r.id = $2) order by r.created_at limit 1`,
      [orgId, referrerId],
    ),

  /** The newest referral confirmed since `since` whose attendant has this number: who a missed call is from (C3). */
  latestConfirmedForAttendant: async (phone: string, since: Date): Promise<string | null> =>
    (
      await one<{ referral_id: string }>(
        `select r.id as referral_id from patient_details pd join referrals r on r.id = pd.referral_id
         where pd.attendant_phone_e164 = $1 and r.status in ('confirmed', 'closed') and r.confirmed_at > $2
         order by r.confirmed_at desc limit 1`,
        [phone, since],
      )
    )?.referral_id ?? null,
};
