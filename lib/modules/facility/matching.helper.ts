// Eligibility (docs/03-data-model.md §5.1) and ranking (docs/02-architecture.md §7).
// Ranking inputs are capability, distance and track record only. Never payments or partnerships.

import { NIGHT_DAY_ONLY_PENALTY, NIGHT_FROM_HOUR, NIGHT_TO_HOUR, TIMEZONE } from "@/lib/core/config";
import type { Contact } from "@/lib/core/types";

/** Whether it is night in India at this moment (NIGHT_FROM_HOUR to NIGHT_TO_HOUR). */
export function isNight(at: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: TIMEZONE }).format(at));
  return hour >= NIGHT_FROM_HOUR || hour < NIGHT_TO_HOUR;
}

export interface EligibleRow {
  /** Needed capabilities this hospital offers only in the daytime. */
  day_only_needs?: string[];
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

const hasDayOnlyNeed = (row: EligibleRow): boolean => (row.day_only_needs?.length ?? 0) > 0;

/**
 * A 0 to 1 score: drive time (50%), past acceptance (30%) and how often the desk answers (20%, halved for phone-menu
 * lines). At night a hospital whose needed service is day-only loses NIGHT_DAY_ONLY_PENALTY; it is still called.
 */
export function scoreFacility(row: EligibleRow, contact: Contact | null, night = false): number {
  const time = 1 - Math.min(row.eta_minutes / 90, 1);
  const acceptance = (row.accepted + 1) / (row.answered + 2);
  let answer = contact ? (contact.calls_answered + 1) / (contact.calls_made + 2) : 0;
  if (contact?.is_ivr) answer /= 2;
  return 0.5 * time + 0.3 * acceptance + 0.2 * answer - (night && hasDayOnlyNeed(row) ? NIGHT_DAY_ONLY_PENALTY : 0);
}

/** The short reasons shown for a hospital's rank, for example "has ICU bed + ventilator". */
export function rankReasons(row: EligibleRow, contact: Contact | null, needLabels: string[], night = false): string[] {
  const reasons = [`${row.eta_minutes} min away`];
  // "Ventilator" → "ventilator", but keep "ICU bed" and "CT scan" as written.
  const words = needLabels.map((l) => (/^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l));
  if (words.length) reasons.push(`has ${words.join(" + ")}`);
  if (row.answered >= 3) reasons.push(`accepted ${row.accepted} of ${row.answered} recent`);
  if (contact?.is_ivr) reasons.push("IVR line only");
  if (night && hasDayOnlyNeed(row)) reasons.push("some services are day-only; asked on the call");
  return reasons;
}

/**
 * The rows with their straight-line ETA replaced by road minutes where the router gave one. A hospital the router could not
 * reach, or no answer at all, keeps its estimate.
 */
export function withRoadMinutes(rows: EligibleRow[], road: Array<number | null> | null): EligibleRow[] {
  if (!road) return rows;
  return rows.map((row, i) => {
    const minutes = road[i];
    return minutes === null || minutes === undefined ? row : { ...row, eta_minutes: Math.max(minutes, 1) };
  });
}

/** Eligible hospitals best first, each with its chosen desk number and reasons. */
export function rankFacilities(
  rows: EligibleRow[],
  contactsByFacility: Map<string, Contact[]>,
  needLabels: string[],
  night = false,
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
        score: scoreFacility(row, contact, night),
        contact,
        rank_reasons: rankReasons(row, contact, needLabels, night),
      };
    })
    .sort((a, b) => b.score - a.score || a.distance_km - b.distance_km);
}

/**
 * Max ETA by acuity (C8): skip hospitals further than `maxMinutes` unless nothing nearer is eligible.
 * 0 disables the cap.
 */
export function applyEtaCap<T extends { eta_minutes: number }>(ranked: T[], maxMinutes: number): { kept: T[]; skipped: number } {
  if (!maxMinutes) return { kept: ranked, skipped: 0 };
  const near = ranked.filter((f) => f.eta_minutes <= maxMinutes);
  if (near.length === 0) return { kept: ranked, skipped: 0 };
  return { kept: near, skipped: ranked.length - near.length };
}
