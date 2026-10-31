import type { Contact, Facility } from "@/lib/core/types";

/** Where and what to search: the origin, the radius, the capabilities every hospital must have, and whose directory. */
export interface MatchParams {
  lat: number;
  lng: number;
  radius_km: number;
  needs: string[];
  origin_id: string | null;
  org_id: string;
}

/** A hospital as the Hospitals page lists it: its capabilities, numbers and call record. */
export interface FacilityListItem extends Facility {
  capabilities: string[];
  contacts: Contact[];
  availability_calls: number;
  answered: number;
  accepted: number;
  last_called_at: string | null;
}

/** One row of the facility_stats view. */
export interface FacilityStats {
  facility_id: string;
  availability_calls: number;
  answered: number;
  accepted: number;
  last_called_at: Date | null;
}

/** A hospital being listed: its columns, the services it offers and its desk numbers. */
export interface NewListing extends NewFacility {
  capabilities: string[];
  contacts: Array<{ role: string; phone: string; priority: number; is_ivr: boolean }>;
}

/** The columns a new hospital is inserted with. */
export interface NewFacility {
  name: string;
  kind: string;
  ownership: string;
  address: string | null;
  city: string | null;
  district: string | null;
  lat: number;
  lng: number;
  call_language: string;
  whatsapp_number: string | null;
}

/** A hospital number to add; the phone is already normalised. */
export interface NewContact {
  role: string;
  phone_e164: string;
  priority: number;
  is_ivr: boolean;
}
