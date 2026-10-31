import type { AvailabilityOutcome, Referral } from "@/lib/core/types";

/** What the agent says when the call can't be matched or something went wrong: never leave a desk hanging. */
export const SAFE_END = "Thank them for their help and end the call.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a value Bolna filled in for %(attempt_id)s is a real id (it may be empty or the unreplaced token). */
export const isUuid = (value: string | null | undefined): value is string => !!value && UUID.test(value);

/** "Yes, but no bed" contradicts itself: the answer is kept, but a person must check it first (CLAUDE.md rule 10). */
export const isContradictoryYes = (outcome: AvailabilityOutcome, bedType: string | null): boolean =>
  (outcome === "accepted" || outcome === "conditional") && bedType === "none";

/** Whether the patient no longer needs this hospital: placed at another one, or the referral was cancelled. */
export const lateYesReason = (r: Referral | null, attemptId: string): "placed_elsewhere" | "no_longer_needed" | null => {
  if (!r) return null;
  if (["confirmed", "closed"].includes(r.status) && r.selected_attempt_id !== attemptId) return "placed_elsewhere";
  if (r.status === "cancelled") return "no_longer_needed";
  return null;
};

/** What the agent should do next after record_hospital_response, and what Haazir does after the call. */
export interface ResponsePlan {
  instruction: string;
  /** The yes came too late: record it as released on this call (CallService.recordInCallRelease). */
  releaseInCall: boolean;
  /** Redirected to a valid number: call it next. */
  redialTo: string | null;
}

/** The agent's next sentence for each availability answer (docs/05-voice-agents.md §3). */
export const responsePlan = (input: {
  outcome: AvailabilityOutcome;
  contradictory: boolean;
  late: ReturnType<typeof lateYesReason>;
  doctor: string;
  alternate: string | null;
  recorded: boolean;
}): ResponsePlan => {
  const { outcome, contradictory, late, doctor, alternate, recorded } = input;
  const plan = (instruction: string, extra: Partial<ResponsePlan> = {}): ResponsePlan => ({
    instruction,
    releaseInCall: false,
    redialTo: null,
    ...extra,
  });
  switch (outcome) {
    case "accepted":
    case "conditional":
      if (contradictory) return plan(`Thank them, say ${doctor}'s team will call back to check the bed, and end the call.`);
      // A late yes is answered on the same call, so the desk doesn't hold a bed or get a second "release" call.
      if (late === "placed_elsewhere") {
        return plan(
          "Thank them warmly and tell them the patient has already been placed at another hospital, " +
          "so they don't need to keep a bed. Then end the call.",
          { releaseInCall: recorded },
        );
      }
      if (late === "no_longer_needed") {
        return plan(
          "Thank them warmly and tell them the patient no longer needs a transfer, so they don't need to keep a bed. Then end the call.",
          { releaseInCall: recorded },
        );
      }
      return plan(`Thank them, say ${doctor}'s team will confirm within a few minutes if they send the patient, and end the call.`);
    case "declined":
      return plan("Thank them for their time and end the call.");
    case "redirected":
      if (alternate && recorded) return plan("Thank them, say you will call that number now, and end the call.", { redialTo: alternate });
      return plan("Thank them and end the call.");
    default:
      return plan("Thank them and end the call.");
  }
};

/** The agent's sentence after request_callback. */
export const callbackInstruction = (minutes: number): string =>
  `Say you will call back in about ${minutes} minute${minutes === 1 ? "" : "s"}, thank them, and end the call.`;
