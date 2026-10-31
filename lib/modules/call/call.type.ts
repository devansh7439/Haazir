import type { Attempt } from "@/lib/core/types";

/** The columns a new call needs; everything else starts empty and `status` starts as queued. */
export type NewAttempt = Pick<Attempt, "referral_id" | "purpose" | "to_number" | "call_language"> &
  Partial<Pick<Attempt, "facility_id" | "contact_id" | "parent_attempt_id" | "wave" | "rank" | "distance_km" | "eta_minutes" | "rank_reasons">>;

/** Who recorded an outcome. */
export type OutcomeSource = NonNullable<Attempt["outcome_source"]>;

/** Where a mid-call answer came from: a Bolna function, the simulator, or a WhatsApp quick reply. */
export type Source = Extract<OutcomeSource, "function" | "simulation" | "whatsapp">;

/** A number to dial, and the directory row it came from when there is one. */
export interface DialTarget {
  to_number: string;
  contact_id: string | null;
}

/** Why a hospital is called again. */
export type RedialReason = "callback" | "busy" | "no_answer";

/** A call that may need a second try: to whom, whether it is due now, and why. */
export interface RedialPlan {
  attempt: Attempt;
  target: DialTarget | null;
  due: boolean;
  reason: RedialReason;
}

/** Work that runs after the HTTP response (routes use `after()`, the simulator awaits it). */
export type FollowUp = () => Promise<void>;

export const noFollowUp: FollowUp = async () => {};

/** A Bolna function's answer: `instruction` is read by the agent's LLM, so it is always a plain sentence. */
export interface FunctionResult {
  result: string;
  instruction: string;
  followUp: FollowUp;
}

export interface WebhookResult {
  ok: true;
  attempt_id: string | null;
  applied: boolean;
  followUp: FollowUp;
}
