import "server-only";
import { ApiError } from "@/lib/core/error";
import type { Attempt, Contact, Facility, Referral, Referrer } from "@/lib/core/types";
import { AuthRepository } from "@/lib/modules/auth/auth.repository";
import type { Session } from "@/lib/modules/auth/session.service";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

/**
 * Organisation isolation: every console route loads its rows through these, so one organisation can never read or
 * change another's. A row in another organisation is reported exactly like a missing one (404), so ids can't be probed.
 */
export const ScopeService = {
  /** The referral, or 404 when it is missing or belongs to another organisation. */
  referral: async (s: Session, id: string): Promise<Referral> => {
    const r = await ReferralRepository.get(id);
    if (!r || r.org_id !== s.org) throw ApiError.notFound("Referral not found");
    return r;
  },

  /** The doctor, or 404 when missing or in another organisation. */
  referrer: async (s: Session, id: string): Promise<Referrer> => {
    const r = await AuthRepository.referrer(id);
    if (!r || r.org_id !== s.org) throw ApiError.notFound("Doctor not found");
    return r;
  },

  /** The call, or 404 when missing or in another organisation. */
  attempt: async (s: Session, id: string): Promise<Attempt> => {
    const a = await CallRepository.get(id);
    if (!a || a.org_id !== s.org) throw ApiError.notFound("Call not found");
    return a;
  },

  /** The hospital, or 404 when missing or in another organisation. */
  facility: async (s: Session, id: string): Promise<Facility> => {
    const f = await FacilityRepository.get(id);
    if (!f || f.org_id !== s.org) throw ApiError.notFound("Hospital not found");
    return f;
  },

  /** The hospital contact, or 404 when missing or in another organisation. */
  contact: async (s: Session, id: string): Promise<Contact> => {
    const c = await FacilityRepository.getContact(id);
    if (!c || c.org_id !== s.org) throw ApiError.notFound("Number not found");
    return c;
  },
};
