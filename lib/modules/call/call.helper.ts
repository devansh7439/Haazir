import { BUSY_REDIAL_AFTER_S, MAX_REDIALS_PER_FACILITY } from "@/lib/core/config";
import { secondsBetween } from "@/lib/core/clock";
import type { Attempt, Contact, Facility } from "@/lib/core/types";
import type { DialTarget, RedialPlan } from "@/lib/modules/call/call.type";
import { isTerminal } from "@/lib/modules/call/status.helper";
import { chooseContact } from "@/lib/modules/facility/matching.helper";

/** A yes, with or without a condition. */
export const isAcceptance = (a: Pick<Attempt, "outcome">): boolean => a.outcome === "accepted" || a.outcome === "conditional";

/** The desk is still talking on this call (it hasn't ended or reached wrap-up), so a second call to it would ring busy. */
export const stillOnLine = (a: Pick<Attempt, "status">): boolean => !isTerminal(a.status) && a.status !== "wrapping_up";

/** A name without the "(Demo)" tag the seed data carries, for anything a person reads or hears. */
export const withoutDemoTag = (name: string): string => name.replace(/\s*\(Demo\)/i, "");

/** Address and city, leaving out the seed's placeholder address; empty when neither is known. */
export const facilityArea = (f: Pick<Facility, "address" | "city"> | null): string =>
  [f?.address, f?.city].filter((x) => x && x !== "Demo address").join(", ");

/**
 * Whether a finished availability call should be tried again, and how (docs/02-architecture.md §6.3 steps 2–3).
 * A callback the desk asked for is due at its time; a busy line gets one redial to the same number after
 * BUSY_REDIAL_AFTER_S, then the next number; no answer goes straight to the next number. Null when nothing is
 * left to try, the call was already redialed, or the hospital reached MAX_REDIALS_PER_FACILITY.
 */
export const planRedial = (a: Attempt, all: Attempt[], contacts: Map<string, Contact[]>, now: Date): RedialPlan | null => {
  if (all.some((c) => c.parent_attempt_id === a.id && c.purpose === "availability")) return null;
  const sameFacility = all.filter((x) => x.purpose === "availability" && x.facility_id === a.facility_id);
  const redials = sameFacility.filter((x) => x.parent_attempt_id).length;
  const dialled = new Set(sameFacility.map((x) => x.to_number));
  const alternate = chooseContact((a.facility_id && contacts.get(a.facility_id)) || [], dialled);
  const nextNumber: DialTarget | null = alternate ? { to_number: alternate.phone_e164, contact_id: alternate.id } : null;
  const sameNumber: DialTarget = { to_number: a.to_number, contact_id: a.contact_id };

  if (a.outcome === "callback_later" && a.callback_due_at) {
    // At the limit the desk is handed to the doctor when it asks (FunctionService.requestCallback).
    if (redials >= MAX_REDIALS_PER_FACILITY) return null;
    return { attempt: a, target: sameNumber, due: secondsBetween(a.callback_due_at, now) >= 0, reason: "callback" };
  }
  if (redials >= MAX_REDIALS_PER_FACILITY) return null;
  if (a.status === "busy" && !a.outcome) {
    const parent = a.parent_attempt_id ? all.find((x) => x.id === a.parent_attempt_id) : null;
    const secondBusy = parent?.status === "busy" && parent.to_number === a.to_number;
    const target = secondBusy ? nextNumber : sameNumber;
    if (!target) return null;
    return { attempt: a, target, due: secondsBetween(a.ended_at ?? a.updated_at, now) >= BUSY_REDIAL_AFTER_S, reason: "busy" };
  }
  if (a.status === "no_answer" && !a.outcome && nextNumber) {
    return { attempt: a, target: nextNumber, due: true, reason: "no_answer" };
  }
  return null;
};
