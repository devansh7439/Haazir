import "server-only";
import { one } from "@/lib/core/db";
import type { Session } from "@/lib/session";
import type { Attempt, Contact, Facility, Referral } from "@/lib/core/types";
import { ApiError } from "@/lib/core/error";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

// Every console route loads rows through these, so one organisation can never read or change another's data.
// A row in another organisation is reported as not found.

export async function referralFor(s: Session, id: string): Promise<Referral> {
  const r = await ReferralRepository.get(id);
  if (!r || r.org_id !== s.org) throw ApiError.notFound("Referral not found");
  return r;
}

export async function attemptFor(s: Session, id: string): Promise<Attempt & { org_id: string }> {
  const a = (await CallRepository.get(id)) as (Attempt & { org_id: string }) | null;
  if (!a || a.org_id !== s.org) throw ApiError.notFound("Call not found");
  return a;
}

export async function facilityFor(s: Session, id: string): Promise<Facility> {
  const f = await one<Facility>(`select * from facilities where id = $1`, [id]);
  if (!f || f.org_id !== s.org) throw ApiError.notFound("Hospital not found");
  return f;
}

export async function contactFor(s: Session, id: string): Promise<Contact> {
  const c = await one<Contact & { org_id: string }>(`select * from facility_contacts where id = $1`, [id]);
  if (!c || c.org_id !== s.org) throw ApiError.notFound("Number not found");
  return c;
}
