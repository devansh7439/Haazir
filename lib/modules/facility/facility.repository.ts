import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import type { Capability, Contact, Facility } from "@/lib/core/types";
import type { EligibleRow } from "@/lib/modules/facility/matching.helper";
import type { MatchParams } from "@/lib/modules/facility/facility.type";

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
  eligible: (p: MatchParams): Promise<EligibleRow[]> => q<EligibleRow>(ELIGIBLE_SQL, [p.lat, p.lng, p.radius_km, p.needs, p.origin_id, p.org_id]),

  /** Each hospital's numbers, best first. */
  contactsByFacility: async (ids: string[]): Promise<Map<string, Contact[]>> => {
    const rows = await q<Contact>(`select * from facility_contacts where facility_id = any($1::uuid[]) order by priority, created_at`, [ids]);
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

  setWhatsappNumber: async (id: string, phone: string): Promise<void> => {
    await q(`update facilities set whatsapp_number = $2 where id = $1`, [id, phone]);
  },

  /** Capabilities in the order the codes were given; unknown codes are left out. */
  capabilities: async (codes: string[]): Promise<Capability[]> => {
    const rows = await q<Capability>(`select * from capabilities where code = any($1::text[])`, [codes]);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    return codes.map((c) => byCode.get(c)).filter((c): c is Capability => !!c);
  },
};
