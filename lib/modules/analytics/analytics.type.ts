/** One hospital's availability-call record (C5). */
export interface HospitalStat {
  facility_id: string;
  name: string;
  calls: number;
  answered: number;
  accepted: number;
  median_answer_s: number | null;
  mismatches: number;
  /** Arrival checks this hospital answered, and how many of them said the patient had not arrived (a bounce). */
  arrival_answers: number;
  not_arrived: number;
  last_called_at: string | null;
}

/** The figures behind the proof slide: speed, answers, accuracy and cost, over every referral in scope. */
export interface ProofStats {
  referrals: number;
  /** Referrals that reached a confirmed hold. */
  placed: number;
  /** Median seconds from "Find a bed" to the first recorded yes; null until a referral has one. */
  median_ttfa_s: number | null;
  calls: number;
  answered: number;
  accepted: number;
  /** Availability calls where the live answer and the post-call extraction disagreed (needs review). */
  needs_review: number;
  /** Availability calls with an answer, the base for needs_review. */
  with_outcome: number;
  /** Median conversation length of completed availability calls, seconds. */
  median_call_s: number | null;
  /** Arrival checks answered, and how many said the patient had not arrived: the bounce rate's base and count. */
  arrival_answers: number;
  not_arrived: number;
  /** Median seconds from "Find a bed" to a confirmed bed; null until one is confirmed. */
  median_to_bed_s: number | null;
  /** Median seconds from "Find a bed" to treatment starting, over the referrals where someone recorded it, and how many were. */
  median_to_treatment_s: number | null;
  treated: number;
  /** Sum of Bolna's reported cost over all calls of referrals in scope, in Bolna's units; null until a cost is recorded. */
  total_cost: number | null;
}

/** Availability calls placed in one hour of the day, India time. */
export interface HourStat {
  hour: number;
  calls: number;
  answered: number;
  accepted: number;
}
