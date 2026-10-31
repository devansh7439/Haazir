/** A bed-portal reading as an admin or a scraper sends it. */
export interface SnapshotInput {
  facility_id: string;
  source: string;
  icu_beds_free: number | null;
  ventilators_free: number | null;
  observed_at: string | Date;
}

/** A stored bed-portal reading. */
export interface PortalSnapshot {
  facility_id: string;
  source: string;
  icu_beds_free: number | null;
  ventilators_free: number | null;
  observed_at: Date;
}
