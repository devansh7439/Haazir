import "server-only";
import { now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { normalizePhone } from "@/lib/core/normalize";
import type { Contact, Facility } from "@/lib/core/types";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import type { FacilityListItem, NewFacility } from "@/lib/modules/facility/facility.type";

/** A phone number as stored (E.164), or a 422 naming the field. */
const requirePhone = (raw: string | null | undefined, field: string): string => {
  const p = normalizePhone(raw);
  if (!p) throw ApiError.unprocessable("BAD_NUMBER", `${field} is not a valid phone number`);
  return p;
};

/** Facility columns the Hospitals page may change. */
const EDITABLE = ["name", "address", "lat", "lng", "call_language", "active", "notes"];

/** The Hospitals page: the directory an organisation calls from (docs/04-api-spec.md §2.11). */
export const DirectoryService = {
  /** Every hospital of the organisation with its capabilities, numbers and call record. */
  list: async (orgId: string): Promise<FacilityListItem[]> => {
    const [facilities, caps, contacts, stats] = await Promise.all([
      FacilityRepository.listForOrg(orgId),
      FacilityRepository.capabilityCodesForOrg(orgId),
      FacilityRepository.contactsForOrg(orgId),
      FacilityRepository.stats(),
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
  },

  create: async (orgId: string, b: NewFacility): Promise<Facility> => {
    const whatsapp = b.whatsapp_number ? requirePhone(b.whatsapp_number, "WhatsApp number") : null;
    return FacilityRepository.insert(orgId, { ...b, whatsapp_number: whatsapp });
  },

  /** Changes the editable columns given; with none, returns the hospital unchanged. */
  update: async (id: string, b: Record<string, unknown>): Promise<Facility> => {
    const fields: Record<string, unknown> = {};
    for (const k of EDITABLE) if (b[k] !== undefined) fields[k] = b[k];
    if (b.whatsapp_number !== undefined) {
      fields.whatsapp_number = b.whatsapp_number ? requirePhone(b.whatsapp_number as string, "WhatsApp number") : null;
    }
    const row = Object.keys(fields).length === 0 ? await FacilityRepository.get(id) : await FacilityRepository.update(id, fields);
    if (!row) throw ApiError.notFound("Facility not found");
    return row;
  },

  /** Replaces the hospital's declared capabilities. Returns the codes now declared. */
  setCapabilities: async (id: string, codes: string[]): Promise<string[]> => {
    const unique = [...new Set(codes)];
    const known = await FacilityRepository.capabilities(unique);
    if (known.length !== unique.length) throw ApiError.unprocessable("UNKNOWN_CAPABILITY", "Unknown capability code");
    if (!(await FacilityRepository.exists(id))) throw ApiError.notFound("Facility not found");
    await FacilityRepository.replaceCapabilities(id, unique);
    return unique;
  },

  addContact: async (facilityId: string, b: { role: string; phone: string; priority: number; is_ivr: boolean }): Promise<Contact> =>
    FacilityRepository.upsertContact(facilityId, { role: b.role, phone_e164: requirePhone(b.phone, "Phone"), priority: b.priority, is_ivr: b.is_ivr }),

  /** Changes a number. 409 when the hospital already has the new number. */
  updateContact: async (id: string, b: { role?: string; phone?: string; priority?: number; is_ivr?: boolean; active?: boolean; verified?: boolean }) => {
    const fields: Record<string, unknown> = {};
    if (b.role !== undefined) fields.role = b.role;
    if (b.phone !== undefined) fields.phone_e164 = requirePhone(b.phone, "Phone");
    if (b.priority !== undefined) fields.priority = b.priority;
    if (b.is_ivr !== undefined) fields.is_ivr = b.is_ivr;
    if (b.active !== undefined) fields.active = b.active;
    if (b.verified !== undefined) fields.verified_at = b.verified ? now() : null;
    if (Object.keys(fields).length === 0) throw ApiError.unprocessable("NOTHING_TO_UPDATE", "No fields to update");
    let row: Contact | null;
    try {
      row = await FacilityRepository.updateContact(id, fields);
    } catch {
      throw ApiError.conflict("DUPLICATE_NUMBER", "This hospital already has that number");
    }
    if (!row) throw ApiError.notFound("Contact not found");
    return row;
  },
};
