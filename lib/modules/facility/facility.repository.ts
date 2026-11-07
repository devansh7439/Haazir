import "server-only";
import { now } from "@/lib/core/clock";
import { one, q, setClause } from "@/lib/core/db";
import type { Capability, Contact, Facility } from "@/lib/core/types";
import type { EligibleRow } from "@/lib/modules/facility/matching.helper";
import type { FacilityStats, MatchParams, NearestEmergency, NewContact, NewFacility } from "@/lib/modules/facility/facility.type";

// Eligibility (docs/03-data-model.md §5.1). Parameters: $1 lat, $2 lng, $3 radius_km, $4 needs text[], $5 origin facility id
// (nullable), $6 organisation id, $7 the clock's now (a hospital marked full until later is skipped). Kept as one tested statement so it runs unchanged on PGlite and Supabase.
const ELIGIBLE_SQL = `
with params as (
  select $1::float8 as lat, $2::float8 as lng, $3::int as radius_km,
         $4::text[] as needs, $5::uuid as origin_id, $6::uuid as org_id, $7::timestamptz as now
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
       coalesce(s.accepted, 0)::int               as accepted,
       coalesce((select array_agg(x.capability_code order by x.capability_code) from facility_capabilities x
                 where x.facility_id = d.id and x.capability_code = any(p.needs) and not x.night_available
                   and x.status in ('declared','confirmed')), '{}') as day_only_needs
from dist d
left join caps c on c.facility_id = d.id
left join facility_stats s on s.facility_id = d.id
cross join params p
where d.active
  and d.org_id = p.org_id
  and (p.origin_id is null or d.id <> p.origin_id)
  and coalesce(c.codes, '{}') @> p.needs
  and (d.full_until is null or d.full_until <= p.now)
  and d.distance_km <= p.radius_km
  and exists (select 1 from facility_contacts fc where fc.facility_id = d.id and fc.active)
order by eta_minutes
`;

// Nearest emergency departments. $1 lat, $2 lng, $3 organisation id, $4 origin facility id (nullable), $5 how many.
// A hospital counts when it is a CHC or larger and has an active, direct casualty-desk number; a PHC or nursing home doesn't.
const NEAREST_ED_SQL = `
with dist as (
  select f.id, f.name, f.kind,
         2 * 6371 * asin(sqrt(
           power(sin(radians(f.lat - $1::float8) / 2), 2) +
           cos(radians($1::float8)) * cos(radians(f.lat)) * power(sin(radians(f.lng - $2::float8) / 2), 2)
         )) as distance_km,
         (select fc.phone_e164 from facility_contacts fc
           where fc.facility_id = f.id and fc.active and fc.role = 'casualty_desk' and not fc.is_ivr
           order by fc.priority, fc.created_at limit 1) as phone
  from facilities f
  where f.active and f.org_id = $3::uuid and ($4::uuid is null or f.id <> $4::uuid)
    and f.kind in ('chc','district_hospital','medical_college','private_hospital')
)
select id as facility_id, name, kind,
       round(distance_km::numeric, 1)::float8 as distance_km,
       round(distance_km * 1.4 / 30 * 60)::int as eta_minutes,
       phone
from dist where phone is not null
order by distance_km limit $5::int
`;

/** Hospitals, their phone numbers and their capabilities. */
export const FacilityRepository = {
  get: (id: string): Promise<Facility | null> => one<Facility>(`select * from facilities where id = $1`, [id]),

  getMany: (ids: string[]): Promise<Facility[]> => q<Facility>(`select * from facilities where id = any($1::uuid[])`, [ids]),

  /** Hospitals that can take the case: capable, in range, in the organisation, with an active number. Nearest first. */
  eligible: (p: MatchParams): Promise<EligibleRow[]> =>
    q<EligibleRow>(ELIGIBLE_SQL, [p.lat, p.lng, p.radius_km, p.needs, p.origin_id, p.org_id, now()]),

  /** The closest hospitals with a casualty desk number, whatever they can do: where to stabilise the patient if nobody accepts. */
  nearestEmergency: (p: { lat: number; lng: number; org_id: string; origin_id: string | null; limit?: number }): Promise<NearestEmergency[]> =>
    q<NearestEmergency>(NEAREST_ED_SQL, [p.lat, p.lng, p.org_id, p.origin_id, p.limit ?? 3]),

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
  /** Remembers the Google place a hospital was matched to. */
  setGooglePlaceId: async (id: string, placeId: string): Promise<void> => {
    await q(`update facilities set google_place_id = $2 where id = $1`, [id, placeId]);
  },

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

  /** How many hospitals are in the directory, across organisations. For the setup script's summary. */
  count: async (): Promise<number> => (await one<{ n: number }>(`select count(*)::int as n from facilities`))?.n ?? 0,

  /** Each hospital's declared or confirmed capabilities, by code. */
  capabilityCodesForOrg: (orgId: string): Promise<Array<{ facility_id: string; capability_code: string; night_available: boolean }>> =>
    q(
      `select facility_id, capability_code, night_available from facility_capabilities
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

  /**
   * Makes `codes` the hospital's declared capabilities: others are removed, these are added or declared again. `dayOnly`
   * (a subset of `codes`) marks the services only there in the daytime; left out, each service keeps its flag.
   */
  replaceCapabilities: async (id: string, codes: string[], dayOnly?: string[]): Promise<void> => {
    await q(`delete from facility_capabilities where facility_id = $1 and not (capability_code = any($2::text[]))`, [id, codes]);
    for (const code of codes) {
      const night = dayOnly ? !dayOnly.includes(code) : null;
      await q(
        `insert into facility_capabilities (facility_id, capability_code, status, source, last_confirmed_at, night_available)
         values ($1, $2, 'declared', 'manual', $3, coalesce($4::boolean, true))
         on conflict (facility_id, capability_code) do update
           set status = 'declared', night_available = coalesce($4::boolean, facility_capabilities.night_available)`,
        [id, code, now(), night],
      );
    }
  },

  /** Which of the needed capabilities this hospital offers only in the daytime. */
  dayOnlyNeeds: async (facilityId: string, codes: string[]): Promise<string[]> =>
    (await q<{ capability_code: string }>(
      `select capability_code from facility_capabilities
       where facility_id = $1 and capability_code = any($2::text[]) and not night_available and status in ('declared','confirmed')`,
      [facilityId, codes],
    )).map((r) => r.capability_code),

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
