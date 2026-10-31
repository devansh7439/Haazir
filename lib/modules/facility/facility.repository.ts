import "server-only";
import { now } from "@/lib/core/clock";
import { one, q, setClause } from "@/lib/core/db";
import type { Capability, Contact, Facility } from "@/lib/core/types";
import type { EligibleRow } from "@/lib/modules/facility/matching.helper";
import type { FacilityStats, MatchParams, NewContact, NewFacility } from "@/lib/modules/facility/facility.type";

// Eligibility (docs/03-data-model.md §5.1). Parameters: $1 lat, $2 lng, $3 radius_km, $4 needs text[], $5 origin facility id
// (nullable), $6 organisation id. Kept as one tested statement so it runs unchanged on PGlite and Supabase.
const ELIGIBLE_SQL = `
with params as (
  select $1::float8 as lat, $2::float8 as lng, $3::int as radius_km,
         $4::text[] as needs, $5::uuid as origin_id, $6::uuid as org_id
),
caps as (
  select facility_id, array_agg(capability_code) as codes
  from facility_capabilities
  where status in ('declared','confirmed')
  group by facility_id
),
dist as (
  select f.*,
         2 * 6371 * asin(sqrt(
           power(sin(radians(f.lat - p.lat) / 2), 2) +
           cos(radians(p.lat)) * cos(radians(f.lat)) * power(sin(radians(f.lng - p.lng) / 2), 2)
         )) as distance_km
  from facilities f cross join params p
)
select d.id, d.name, d.lat, d.lng,
       round(d.distance_km::numeric, 1)::float8   as distance_km,
       round(d.distance_km * 1.4 / 30 * 60)::int  as eta_minutes,
       d.call_language,
       coalesce(s.availability_calls, 0)::int     as availability_calls,
       coalesce(s.answered, 0)::int               as answered,
       coalesce(s.accepted, 0)::int               as accepted
from dist d
left join caps c on c.facility_id = d.id
left join facility_stats s on s.facility_id = d.id
cross join params p
where d.active
  and d.org_id = p.org_id
  and (p.origin_id is null or d.id <> p.origin_id)
  and coalesce(c.codes, '{}') @> p.needs
  and d.distance_km <= p.radius_km
  and exists (select 1 from facility_contacts fc where fc.facility_id = d.id and fc.active)
order by eta_minutes
`;

/** Hospitals, their phone numbers and their capabilities. */
export const FacilityRepository = {
  get: (id: string): Promise<Facility | null> => one<Facility>(`select * from facilities where id = $1`, [id]),

  getMany: (ids: string[]): Promise<Facility[]> => q<Facility>(`select * from facilities where id = any($1::uuid[])`, [ids]),

  /** Hospitals that can take the case: capable, in range, in the organisation, with an active number. Nearest first. */
  eligible: (p: MatchParams): Promise<EligibleRow[]> =>
    q<EligibleRow>(ELIGIBLE_SQL, [p.lat, p.lng, p.radius_km, p.needs, p.origin_id, p.org_id]),

  /** Each hospital's numbers, best first. */
  contactsByFacility: async (ids: string[]): Promise<Map<string, Contact[]>> => {
    const rows = await q<Contact>(
      `select * from facility_contacts where facility_id = any($1::uuid[]) order by priority, created_at`,
      [ids],
    );
    const map = new Map<string, Contact[]>();
    for (const c of rows) map.set(c.facility_id, [...(map.get(c.facility_id) ?? []), c]);
    return map;
  },

  getContact: (id: string): Promise<Contact | null> => one<Contact>(`select * from facility_contacts where id = $1`, [id]),

  /** Adds an unverified number (e.g. from a redirect), or reactivates it. Null without a hospital. */
  addUnverifiedContact: async (facilityId: string | null, phone: string, role: string): Promise<string | null> => {
    if (!facilityId) return null;
    const row = await one<{ id: string }>(
      `insert into facility_contacts (facility_id, role, phone_e164, priority, is_ivr, created_at)
       values ($1, $2, $3, 9, false, $4)
       on conflict (facility_id, phone_e164) do update set active = true
       returning id`,
      [facilityId, role, phone, now()],
    );
    return row?.id ?? null;
  },

  /** Sets or clears the number the pre-arrival note goes to. */
  setWhatsappNumber: async (id: string, phone: string | null): Promise<void> => {
    await q(`update facilities set whatsapp_number = $2 where id = $1`, [id, phone]);
  },

  /** Every capability, by category and label, for the form and the Hospitals page. */
  allCapabilities: (): Promise<Capability[]> => q<Capability>(`select * from capabilities order by category, label`),

  /** Capabilities in the order the codes were given; unknown codes are left out. */
  capabilities: async (codes: string[]): Promise<Capability[]> => {
    const rows = await q<Capability>(`select * from capabilities where code = any($1::text[])`, [codes]);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    return codes.map((c) => byCode.get(c)).filter((c): c is Capability => !!c);
  },

  // ------------------------------------------------------------- the Hospitals page (docs/04-api-spec.md §2.11)

  /** Every hospital of an organisation, demo hospitals first, then by name. */
  listForOrg: (orgId: string): Promise<Facility[]> =>
    q<Facility>(`select * from facilities where org_id = $1 order by is_demo desc, name`, [orgId]),

  /** Each hospital's declared or confirmed capabilities, by code. */
  capabilityCodesForOrg: (orgId: string): Promise<Array<{ facility_id: string; capability_code: string }>> =>
    q(
      `select facility_id, capability_code from facility_capabilities
       where org_id = $1 and status in ('declared','confirmed') order by capability_code`,
      [orgId],
    ),

  contactsForOrg: (orgId: string): Promise<Contact[]> =>
    q<Contact>(`select * from facility_contacts where org_id = $1 order by priority, created_at`, [orgId]),

  /** Call counts per hospital (the facility_stats view). */
  stats: (): Promise<FacilityStats[]> =>
    q<FacilityStats>(`select facility_id, availability_calls::int, answered::int, accepted::int, last_called_at from facility_stats`),

  exists: async (id: string): Promise<boolean> => !!(await one(`select 1 from facilities where id = $1`, [id])),

  insert: async (orgId: string, f: NewFacility): Promise<Facility> => {
    const t = now();
    const row = await one<Facility>(
      `insert into facilities (name, kind, ownership, address, city, district, lat, lng, call_language, whatsapp_number,
         created_at, updated_at, org_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12) returning *`,
      [f.name, f.kind, f.ownership, f.address, f.city, f.district, f.lat, f.lng, f.call_language, f.whatsapp_number, t, orgId],
    );
    return row!;
  },

  /** Sets the given columns. Null when there is no such hospital. */
  update: (id: string, fields: Record<string, unknown>): Promise<Facility | null> => {
    const set = setClause(fields, 2);
    return one<Facility>(`update facilities set ${set.sql} where id = $1 returning *`, [id, ...set.values]);
  },

  /** Makes `codes` the hospital's declared capabilities: others are removed, these are added or declared again. */
  replaceCapabilities: async (id: string, codes: string[]): Promise<void> => {
    await q(`delete from facility_capabilities where facility_id = $1 and not (capability_code = any($2::text[]))`, [id, codes]);
    for (const code of codes) {
      await q(
        `insert into facility_capabilities (facility_id, capability_code, status, source, last_confirmed_at)
         values ($1, $2, 'declared', 'manual', $3)
         on conflict (facility_id, capability_code) do update set status = 'declared'`,
        [id, code, now()],
      );
    }
  },

  /** Adds a number to a hospital, or updates and reactivates it when the hospital already has it. */
  upsertContact: async (facilityId: string, c: NewContact): Promise<Contact> => {
    const row = await one<Contact>(
      `insert into facility_contacts (facility_id, role, phone_e164, priority, is_ivr, created_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (facility_id, phone_e164) do update set role = excluded.role, priority = excluded.priority,
         is_ivr = excluded.is_ivr, active = true
       returning *`,
      [facilityId, c.role, c.phone_e164, c.priority, c.is_ivr, now()],
    );
    return row!;
  },

  /** Sets the given columns. Null when there is no such number; throws on a duplicate number (unique index). */
  updateContact: (id: string, fields: Record<string, unknown>): Promise<Contact | null> => {
    const set = setClause(fields, 2);
    return one<Contact>(`update facility_contacts set ${set.sql} where id = $1 returning *`, [id, ...set.values]);
  },
};
