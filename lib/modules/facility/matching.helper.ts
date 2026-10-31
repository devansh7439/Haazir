// Eligibility (docs/03-data-model.md §5.1) and ranking (docs/02-architecture.md §7).
// Ranking inputs are capability, distance and track record only. Never payments or partnerships.

import type { Contact } from "@/lib/core/types";

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
