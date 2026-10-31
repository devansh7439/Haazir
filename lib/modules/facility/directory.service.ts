import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import { normalizePhone } from "@/lib/core/normalize";
import type { Contact, Facility } from "@/lib/core/types";
import { ApiError } from "@/lib/core/error";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";

// Facilities admin (docs/04-api-spec.md §2.11).

export interface FacilityListItem extends Facility {
  capabilities: string[];
  contacts: Contact[];
  availability_calls: number;
  answered: number;
  accepted: number;
  last_called_at: string | null;
}

export async function listFacilities(orgId: string): Promise<FacilityListItem[]> {
  const [facilities, caps, contacts, stats] = await Promise.all([
    q<Facility>(`select * from facilities where org_id = $1 order by is_demo desc, name`, [orgId]),
    q<{ facility_id: string; capability_code: string }>(
      `select facility_id, capability_code from facility_capabilities where org_id = $1 and status in ('declared','confirmed') order by capability_code`,
      [orgId],
    ),
    q<Contact>(`select * from facility_contacts where org_id = $1 order by priority, created_at`, [orgId]),
    q<{ facility_id: string; availability_calls: number; answered: number; accepted: number; last_called_at: Date | null }>(
      `select facility_id, availability_calls::int, answered::int, accepted::int, last_called_at from facility_stats`,
    ),
  ]);
  const statBy = new Map(stats.map((s) => [s.facility_id, s]));
  return facilities.map((f) => {
    const s = statBy.get(f.id);
    return {
      ...f,
      capabilities: caps.filter((c) => c.facility_id === f.id).map((c) => c.capability_code),
      contacts: contacts.filter((c) => c.facility_id === f.id),
      availability_calls: s?.availability_calls ?? 0,
      answered: s?.answered ?? 0,
      accepted: s?.accepted ?? 0,
      last_called_at: s?.last_called_at ? new Date(s.last_called_at).toISOString() : null,
    };
  });
}

function requirePhone(raw: string | null | undefined, field: string): string {
  const p = normalizePhone(raw);
  if (!p) throw ApiError.unprocessable("BAD_NUMBER", `${field} is not a valid phone number`);
  return p;
}

export async function createFacility(orgId: string, b: {
  name: string; kind: string; ownership: string; address: string | null; city: string | null; district: string | null;
  lat: number; lng: number; call_language: string; whatsapp_number: string | null;
}): Promise<Facility> {
  const wa = b.whatsapp_number ? requirePhone(b.whatsapp_number, "WhatsApp number") : null;
  const t = now();
  const row = await one<Facility>(
    `insert into facilities (name, kind, ownership, address, city, district, lat, lng, call_language, whatsapp_number, created_at, updated_at, org_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12) returning *`,
    [b.name, b.kind, b.ownership, b.address, b.city, b.district, b.lat, b.lng, b.call_language, wa, t, orgId],
  );
  return row!;
}

export async function patchFacility(id: string, b: Record<string, unknown>): Promise<Facility> {
  const fields: Record<string, unknown> = {};
  for (const k of ["name", "address", "lat", "lng", "call_language", "active", "notes"]) if (b[k] !== undefined) fields[k] = b[k];
  if (b.whatsapp_number !== undefined) {
    fields.whatsapp_number = b.whatsapp_number ? requirePhone(b.whatsapp_number as string, "WhatsApp number") : null;
  }
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    const f = await one<Facility>(`select * from facilities where id = $1`, [id]);
    if (!f) throw ApiError.notFound("Facility not found");
    return f;
  }
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const row = await one<Facility>(`update facilities set ${set} where id = $1 returning *`, [id, ...keys.map((k) => fields[k])]);
  if (!row) throw ApiError.notFound("Facility not found");
  return row;
}

/** Replaces the facility's static capabilities. */
export async function setCapabilities(id: string, codes: string[]): Promise<string[]> {
  const unique = [...new Set(codes)];
  const known = await FacilityRepository.capabilities(unique);
  if (known.length !== unique.length) throw ApiError.unprocessable("UNKNOWN_CAPABILITY", "Unknown capability code");
  if (!(await one(`select 1 from facilities where id = $1`, [id]))) throw ApiError.notFound("Facility not found");
  await q(`delete from facility_capabilities where facility_id = $1 and not (capability_code = any($2::text[]))`, [id, unique]);
  for (const code of unique) {
    await q(
      `insert into facility_capabilities (facility_id, capability_code, status, source, last_confirmed_at)
       values ($1, $2, 'declared', 'manual', $3)
       on conflict (facility_id, capability_code) do update set status = 'declared'`,
      [id, code, now()],
    );
  }
  return unique;
}

export async function addFacilityContact(facilityId: string, b: { role: string; phone: string; priority: number; is_ivr: boolean }) {
  const phone = requirePhone(b.phone, "Phone");
  const row = await one<Contact>(
    `insert into facility_contacts (facility_id, role, phone_e164, priority, is_ivr, created_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (facility_id, phone_e164) do update set role = excluded.role, priority = excluded.priority,
       is_ivr = excluded.is_ivr, active = true
     returning *`,
    [facilityId, b.role, phone, b.priority, b.is_ivr, now()],
  );
  return row!;
}

export async function patchContact(id: string, b: {
  role?: string; phone?: string; priority?: number; is_ivr?: boolean; active?: boolean; verified?: boolean;
}) {
  const fields: Record<string, unknown> = {};
  if (b.role !== undefined) fields.role = b.role;
  if (b.phone !== undefined) fields.phone_e164 = requirePhone(b.phone, "Phone");
  if (b.priority !== undefined) fields.priority = b.priority;
  if (b.is_ivr !== undefined) fields.is_ivr = b.is_ivr;
  if (b.active !== undefined) fields.active = b.active;
  if (b.verified !== undefined) fields.verified_at = b.verified ? now() : null;
  const keys = Object.keys(fields);
  if (keys.length === 0) throw ApiError.unprocessable("NOTHING_TO_UPDATE", "No fields to update");
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  try {
    const row = await one<Contact>(`update facility_contacts set ${set} where id = $1 returning *`, [id, ...keys.map((k) => fields[k])]);
    if (!row) throw ApiError.notFound("Contact not found");
    return row;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.conflict("DUPLICATE_NUMBER", "This hospital already has that number");
  }
}
