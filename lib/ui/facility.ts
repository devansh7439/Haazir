import type { Capability } from "@/lib/core/types";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";

// Client-safe helpers for the Hospitals page: what a hospital offers, how to find it and how to reach it.

export const KIND_LABEL: Record<string, string> = {
  phc: "Primary health centre",
  chc: "Community health centre",
  district_hospital: "District hospital",
  medical_college: "Medical college",
  private_hospital: "Private hospital",
  nursing_home: "Nursing home",
  other: "Other",
};

export const OWNERSHIP_LABEL: Record<string, string> = { public: "Public", private: "Private", trust: "Trust", unknown: "Not stated" };

export const CONTACT_ROLE_LABEL: Record<string, string> = {
  casualty_desk: "Casualty desk",
  referral_desk: "Referral desk",
  nursing_station: "Nursing station",
  duty_manager: "Duty manager",
  reception: "Reception",
  other: "Other",
};

const CATEGORY_LABEL: Record<string, string> = {
  bed: "Beds",
  equipment: "Equipment",
  service: "Services",
  specialist: "Specialists",
  drug: "Drugs and stock",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

/** The capabilities (all of them, or just the codes given) grouped under readable headings, in a fixed order. */
export function groupByCategory(capabilities: Capability[], codes?: string[]): Array<{ category: string; title: string; items: Capability[] }> {
  const wanted = codes ? new Set(codes) : null;
  const byCategory = new Map<string, Capability[]>();
  for (const c of capabilities) {
    if (wanted && !wanted.has(c.code)) continue;
    byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);
  }
  const order = [...CATEGORY_ORDER, ...[...byCategory.keys()].filter((k) => !CATEGORY_ORDER.includes(k))];
  return order
    .filter((k) => byCategory.has(k))
    .map((k) => ({ category: k, title: CATEGORY_LABEL[k] ?? k, items: byCategory.get(k)! }));
}

/** Hospitals whose name, city or district contains the query and that offer every service asked for. */
export function filterFacilities(rows: FacilityListItem[], query: string, services: string[]): FacilityListItem[] {
  const q = query.trim().toLowerCase();
  return rows.filter((f) => {
    if (q && ![f.name, f.city ?? "", f.district ?? ""].some((v) => v.toLowerCase().includes(q))) return false;
    return services.every((s) => f.capabilities.includes(s));
  });
}

/** A link that opens the dialler. */
export const telLink = (phone: string): string => `tel:${phone}`;

/** A link that opens the point in Google Maps. */
export const mapsLink = (lat: number, lng: number): string => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** The number to ring first: the best active direct desk line (lowest priority, phone-menu lines last), or null. */
export function firstDesk(f: FacilityListItem): FacilityListItem["contacts"][number] | null {
  const usable = f.contacts.filter((c) => c.active);
  usable.sort((a, b) => Number(a.is_ivr) - Number(b.is_ivr) || a.priority - b.priority);
  return usable[0] ?? null;
}
