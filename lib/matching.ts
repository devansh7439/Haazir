// Eligibility (docs/03-data-model.md §5.1) and ranking (docs/02-architecture.md §7).
// Ranking inputs are capability, distance and track record only. Never payments or partnerships.

import type { Contact } from "./types";

export interface EligibleRow {
  id: string;
  name: string;
  distance_km: number;
  eta_minutes: number;
  call_language: string;
  lat: number;
  lng: number;
  availability_calls: number;
  answered: number;
  accepted: number;
}

export interface RankedFacility {
  facility_id: string;
  name: string;
  distance_km: number;
  eta_minutes: number;
  call_language: string;
  lat: number;
  lng: number;
  score: number;
  contact: Contact | null;
  rank_reasons: string[];
}

/** Lowest priority among non-IVR active contacts; IVR numbers only as a last resort. */
export function chooseContact(contacts: Contact[], exclude: Set<string> = new Set()): Contact | null {
  const usable = contacts.filter((c) => c.active && !exclude.has(c.phone_e164));
  usable.sort((a, b) => Number(a.is_ivr) - Number(b.is_ivr) || a.priority - b.priority);
  return usable[0] ?? null;
}

export function scoreFacility(row: EligibleRow, contact: Contact | null): number {
  const time = 1 - Math.min(row.eta_minutes / 90, 1);
  const acceptance = (row.accepted + 1) / (row.answered + 2);
  let answer = contact ? (contact.calls_answered + 1) / (contact.calls_made + 2) : 0;
  if (contact?.is_ivr) answer /= 2;
  return 0.5 * time + 0.3 * acceptance + 0.2 * answer;
}

export function rankReasons(row: EligibleRow, contact: Contact | null, needLabels: string[]): string[] {
  const reasons = [`${row.eta_minutes} min away`];
  // "Ventilator" → "ventilator", but keep "ICU bed" and "CT scan" as written.
  const words = needLabels.map((l) => (/^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l));
  if (words.length) reasons.push(`has ${words.join(" + ")}`);
  if (row.answered >= 3) reasons.push(`accepted ${row.accepted} of ${row.answered} recent`);
  if (contact?.is_ivr) reasons.push("IVR line only");
  return reasons;
}

export function rankFacilities(
  rows: EligibleRow[],
  contactsByFacility: Map<string, Contact[]>,
  needLabels: string[],
): RankedFacility[] {
  return rows
    .map((row) => {
      const contact = chooseContact(contactsByFacility.get(row.id) ?? []);
      return {
        facility_id: row.id,
        name: row.name,
        distance_km: row.distance_km,
        eta_minutes: row.eta_minutes,
        call_language: row.call_language,
        lat: row.lat,
        lng: row.lng,
        score: scoreFacility(row, contact),
        contact,
        rank_reasons: rankReasons(row, contact, needLabels),
      };
    })
    .sort((a, b) => b.score - a.score || a.distance_km - b.distance_km);
}

export function etaMinutes(distanceKm: number, roadFactor = 1.4, speedKmph = 30): number {
  return Math.round(((distanceKm * roadFactor) / speedKmph) * 60);
}

/** Parameters: $1 lat, $2 lng, $3 radius_km, $4 needs text[], $5 origin facility id (nullable). */
export const ELIGIBLE_SQL = `
with params as (
  select $1::float8 as lat, $2::float8 as lng, $3::int as radius_km,
         $4::text[] as needs, $5::uuid as origin_id
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
  and (p.origin_id is null or d.id <> p.origin_id)
  and coalesce(c.codes, '{}') @> p.needs
  and d.distance_km <= p.radius_km
  and exists (select 1 from facility_contacts fc where fc.facility_id = d.id and fc.active)
order by eta_minutes
`;
