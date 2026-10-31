/** One hospital's availability-call record (C5). */
export interface HospitalStat {
  facility_id: string;
  name: string;
  calls: number;
  answered: number;
  accepted: number;
  median_answer_s: number | null;
  mismatches: number;
  last_called_at: string | null;
}

/** Availability calls placed in one hour of the day, India time. */
export interface HourStat {
  hour: number;
  calls: number;
  answered: number;
  accepted: number;
}
