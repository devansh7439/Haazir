import { clean, normalizeBedType, normalizeOutcome, parseMinutes } from "@/lib/core/normalize";
import type { Attempt, AvailabilityOutcome } from "@/lib/core/types";
import { isTerminal, type MappedStatus } from "@/lib/modules/call/status.helper";

/** A Bolna payload or part of one: any JSON value. */
type Json = unknown;

/** Case-insensitive key lookup, since a category renamed in Bolna's dashboard silently breaks exact matches. */
export const pick = (obj: Json, name: string): Json => {
  if (!obj || typeof obj !== "object") return undefined;
  const key = Object.keys(obj).find((k) => k.trim().toLowerCase() === name.toLowerCase());
  return key ? (obj as Record<string, Json>)[key] : undefined;
};

/** The value under exactly `key`, or undefined when `obj` is not an object or has no such key. */
export const prop = (obj: Json, key: string): Json =>
  obj && typeof obj === "object" && key in obj ? (obj as Record<string, Json>)[key] : undefined;

/** One extracted value and whether Bolna was confident about it (high or medium). A bare string is never confident. */
export const extraction = (data: Json, category: string, name: string): { value: string | null; confident: boolean } => {
  const v = pick(pick(data, category), name);
  if (v === undefined || v === null) return { value: null, confident: false };
  if (typeof v === "string") return { value: clean(v), confident: false };
  const label = String(prop(v, "confidence_label") ?? "").toLowerCase();
  return { value: clean(prop(v, "objective")), confident: label === "high" || label === "medium" };
};

const isYes = (o: string | null): boolean => o === "accepted" || o === "conditional";

/** The execution id a webhook is about: `id`, else `execution_id`. */
export const executionIdOf = (b: Record<string, Json>): string | null =>
  typeof b.id === "string" ? b.id : typeof b.execution_id === "string" ? b.execution_id : null;

/** The attempt id a webhook carries in its context, for a call whose execution id we never stored. */
export const attemptIdOf = (b: Record<string, Json>): string | null => {
  const ctx = b.context_details;
  return clean(pick(pick(ctx, "recipient_data"), "attempt_id") ?? pick(ctx, "attempt_id") ?? pick(b.user_data, "attempt_id"));
};

/**
 * The columns a status webhook sets. Final fields are read only at `completed` (CLAUDE.md rule 2). The family call's
 * transcript and recording are never stored: they name the attendant, and call_attempts is readable by the console.
 */
export const statusFields = (
  attempt: Attempt,
  mapped: MappedStatus,
  b: Record<string, Json>,
  rawStatus: string | null,
  now: Date,
): Partial<Attempt> => {
  const executionId = executionIdOf(b);
  const fields: Partial<Attempt> = { bolna_status: rawStatus };
  if (executionId && !attempt.bolna_execution_id) fields.bolna_execution_id = executionId;
  const termination = clean(b.termination_reason);
  if (termination) fields.termination_reason = termination;
  if (mapped.status === "dialing" && !attempt.dispatched_at) fields.dispatched_at = now;
  if (mapped.status === "in_progress" && !attempt.answered_at) fields.answered_at = now;
  if (mapped.status === "wrapping_up") fields.ended_at = now;
  if (isTerminal(mapped.status) && !attempt.ended_at) fields.ended_at = now;
  if (mapped.status === "completed" && attempt.purpose !== "family_update") {
    fields.transcript = typeof b.transcript === "string" ? b.transcript : null;
    fields.recording_url = clean(prop(b.telephony_data, "recording_url"));
    fields.extracted_data = b.extracted_data ?? null;
  }
  return fields;
};

/** What a completed availability call's extraction means for it. */
export type AvailabilityReading =
  /** The call already has an answer; `review` when the extraction disagrees about whether it was a yes. */
  | { kind: "answered"; extractionOutcome: AvailabilityOutcome | null; review: boolean }
  /** No answer during the call: this is the outcome to record, with the fields that go with it. */
  | { kind: "outcome"; extractionOutcome: AvailabilityOutcome | null; outcome: AvailabilityOutcome; fields: Partial<Attempt> };

/**
 * Reads a completed availability call (docs/05-voice-agents.md §5). A disagreement about whether the hospital said
 * yes is never resolved automatically, except that the doctor's own record wins. Without an answer, a voicemail or
 * phone menu is `ivr_blocked`; a confident extraction is used unless it is a yes with no bed; anything else is
 * `unclear` (CLAUDE.md rule 10: never record `accepted` from ambiguous data).
 */
export const readAvailability = (a: Attempt, body: Record<string, Json>): AvailabilityReading => {
  const data = a.extracted_data;
  const field = (name: string) => extraction(data, "Referral outcome", name);
  const ex = field("availability_outcome");
  const extractionOutcome = ex.value ? normalizeOutcome(ex.value) : null;

  if (a.outcome) {
    const review = !!extractionOutcome && a.outcome_source !== "manual" && isYes(a.outcome) !== isYes(extractionOutcome);
    return { kind: "answered", extractionOutcome, review };
  }

  const voicemail = a.termination_reason === "voicemail_reached" || body.answered_by_voice_mail === true;
  if (voicemail || extractionOutcome === "ivr_blocked") return { kind: "outcome", extractionOutcome, outcome: "ivr_blocked", fields: {} };
  const noBedYes = !!extractionOutcome && isYes(extractionOutcome) && normalizeBedType(field("bed_type").value) === "none";
  if (!extractionOutcome || !ex.confident || noBedYes) return { kind: "outcome", extractionOutcome, outcome: "unclear", fields: {} };

  const declineReason = field("decline_reason").value;
  return {
    kind: "outcome",
    extractionOutcome,
    outcome: extractionOutcome,
    fields: {
      bed_type: normalizeBedType(field("bed_type").value),
      ready_in_minutes: parseMinutes(field("ready_in_minutes").value),
      contact_person: field("contact_person").value,
      conditions: field("conditions").value,
      decline_reason: declineReason === "not_applicable" ? null : declineReason,
    },
  };
};
