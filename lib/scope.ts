import "server-only";
import { one } from "./db";
import { AppError, getAttempt, getReferral } from "./repo";
import type { Session } from "./session";
import type { Attempt, Contact, Facility, Referral } from "./types";

// Every console route loads rows through these, so one organisation can never read or change another's data.
// A row in another organisation is reported as not found.

export async function referralFor(s: Session, id: string): Promise<Referral> {
  const r = await getReferral(id);
  if (!r || r.org_id !== s.org) throw new AppError(404, "NOT_FOUND", "Referral not found");
  return r;
}

export async function attemptFor(s: Session, id: string): Promise<Attempt & { org_id: string }> {
  const a = (await getAttempt(id)) as (Attempt & { org_id: string }) | null;
  if (!a || a.org_id !== s.org) throw new AppError(404, "NOT_FOUND", "Call not found");
  return a;
}

export async function facilityFor(s: Session, id: string): Promise<Facility> {
  const f = await one<Facility>(`select * from facilities where id = $1`, [id]);
  if (!f || f.org_id !== s.org) throw new AppError(404, "NOT_FOUND", "Hospital not found");
  return f;
}

export async function contactFor(s: Session, id: string): Promise<Contact> {
  const c = await one<Contact & { org_id: string }>(`select * from facility_contacts where id = $1`, [id]);
  if (!c || c.org_id !== s.org) throw new AppError(404, "NOT_FOUND", "Number not found");
  return c;
}
