import { describe, expect, it } from "vitest";
import type { Attempt, Contact, Referral } from "@/lib/core/types";
import { planRedial } from "@/lib/modules/call/call.helper";
import { lateYesReason, responsePlan } from "@/lib/modules/call/function.helper";
import { readAvailability } from "@/lib/modules/call/webhook.helper";
import { planEvaluation } from "@/lib/modules/referral/referral.helper";
import type { EvaluationStep } from "@/lib/modules/referral/referral.type";

// Pure rules, tested without a database. Times are relative to NOW.

const NOW = new Date("2026-10-31T10:00:00Z");
const ago = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

const referral = (o: Partial<Referral> = {}): Referral => ({
  id: "r1", org_id: "o1", code: "R-1000", status: "searching", referrer_id: "d1", origin_facility_id: null,
  origin_lat: 13, origin_lng: 77, case_type: "snakebite_neuro", acuity: "critical", age_value: 34, age_unit: "years",
  sex: "male", note: null, required_capabilities: [], spoken_summary: "", transport: "ambulance", search_radius_km: 40,
  current_wave: 1, wave_started_at: ago(30), selected_facility_id: null, selected_attempt_id: null, hold_expires_at: null,
  first_acceptance_at: null, confirmed_at: null, closed_at: null, close_reason: null, is_simulated: true, is_demo: true,
  created_at: ago(60), updated_at: ago(30), ...o,
});

let seq = 0;
const attempt = (o: Partial<Attempt> = {}): Attempt => ({
  id: `a${++seq}`, org_id: "o1", referral_id: "r1", facility_id: "f1", contact_id: "c1", parent_attempt_id: null, purpose: "availability",
  wave: 1, rank: 1, distance_km: 5, eta_minutes: 18, rank_reasons: [], to_number: "+911", call_language: "en",
  bolna_agent_id: null, bolna_execution_id: null, status: "ringing", bolna_status: null, termination_reason: null,
  outcome: null, outcome_source: null, extraction_outcome: null, needs_review: false, bed_type: null,
  specialist_available: null, ready_in_minutes: null, conditions: null, contact_person: null, decline_reason: null,
  alternate_number: null, callback_due_at: null, transcript: null, recording_url: null, extracted_data: null,
  dispatched_at: ago(30), answered_at: null, outcome_at: null, ended_at: null, last_polled_at: null,
  created_at: ago(30), updated_at: ago(30), ...o,
});

const contact = (o: Partial<Contact> = {}): Contact => ({
  id: "c2", org_id: "o1", facility_id: "f1", role: "desk", phone_e164: "+912", priority: 2, is_ivr: false, verified_at: null,
  calls_made: 0, calls_answered: 0, last_outcome: null, active: true, ...o,
});

const plan = (r: Referral, attempts: Attempt[], contacts = new Map<string, Contact[]>()) =>
  planEvaluation({ referral: r, attempts, contacts }, NOW);
const kinds = (steps: EvaluationStep[]) => steps.map((s) => s.kind);

describe("planEvaluation", () => {
  it("plans nothing for a draft or a closed test call", () => {
    expect(plan(referral({ status: "draft" }), [attempt()])).toEqual([]);
    expect(plan(referral({ status: "closed", close_reason: "test_call" }), [attempt({ outcome: "accepted" })])).toEqual([]);
  });

  it("releases every yes on cancel, including one under review, and only once", () => {
    const yes = attempt({ outcome: "accepted", status: "completed" });
    const review = attempt({ facility_id: "f2", outcome: "conditional", needs_review: true, status: "completed" });
    const released = attempt({ facility_id: "f3", outcome: "accepted", status: "completed" });
    const release = attempt({ purpose: "release", parent_attempt_id: released.id, facility_id: "f3" });
    const steps = plan(referral({ status: "cancelled" }), [yes, review, released, release]);
    expect(steps).toEqual([{ kind: "release", attempt: yes }, { kind: "release", attempt: review }]);
  });

  it("keeps the chosen hospital when a placed referral is closed", () => {
    const chosen = attempt({ outcome: "accepted", status: "completed" });
    const other = attempt({ facility_id: "f2", outcome: "accepted", status: "completed" });
    expect(plan(referral({ status: "closed", selected_attempt_id: chosen.id }), [chosen, other])).toEqual([{ kind: "release", attempt: other }]);
  });

  it("waits to dial a hold call while the accepting desk is still on the line, up to 90 s", () => {
    const yes = attempt({ outcome: "accepted", status: "in_progress" });
    const hold = (createdAgo: number) => attempt({ purpose: "hold_confirm", parent_attempt_id: yes.id, status: "queued", created_at: ago(createdAgo) });
    const r = referral({ status: "confirming", first_acceptance_at: ago(10) });
    expect(kinds(plan(r, [yes, hold(10)]))).not.toContain("dispatch_hold");
    expect(kinds(plan(r, [yes, hold(95)]))).toContain("dispatch_hold");
    expect(kinds(plan(r, [{ ...yes, status: "wrapping_up" }, hold(10)]))).toContain("dispatch_hold");
  });

  it("marks the earliest confident yes as the first acceptance and opens options", () => {
    const late = attempt({ outcome: "accepted", outcome_at: ago(5) });
    const early = attempt({ facility_id: "f2", outcome: "conditional", outcome_at: ago(20) });
    const steps = plan(referral(), [late, early]);
    expect(steps[0]).toEqual({ kind: "first_acceptance", attempt: early });
    expect(kinds(steps)).toContain("options_ready");
    expect(kinds(steps)).not.toContain("next_wave");
  });

  it("never counts a yes under review as an acceptance", () => {
    const steps = plan(referral(), [attempt({ outcome: "accepted", needs_review: true, status: "completed" })]);
    expect(kinds(steps)).not.toContain("first_acceptance");
    expect(kinds(steps)).not.toContain("options_ready");
  });

  it("goes back to searching when the only yes is gone", () => {
    const declined = attempt({ outcome: "declined", status: "completed" });
    expect(kinds(plan(referral({ status: "options_ready" }), [declined, attempt({ facility_id: "f2" })]))).toEqual(["back_to_searching"]);
  });

  it("redials a busy line after 45 s, not before", () => {
    const busy = (endedAgo: number) => attempt({ status: "busy", ended_at: ago(endedAgo) });
    const later = plan(referral(), [busy(50), attempt({ facility_id: "f2" })]);
    expect(later.find((s) => s.kind === "redial")).toMatchObject({ reason: "busy", target: { to_number: "+911" } });
    expect(kinds(plan(referral(), [busy(10), attempt({ facility_id: "f2" })]))).not.toContain("redial");
  });

  it("opens the next wave when every call is done, or when the wave timed out", () => {
    const done = attempt({ status: "completed", outcome: "declined" });
    expect(plan(referral(), [done])).toEqual([{ kind: "next_wave", expectedWave: 1, exhaustIfEmpty: true }]);
    const timedOut = plan(referral({ wave_started_at: ago(200) }), [attempt({ status: "in_progress" })]);
    expect(timedOut).toEqual([{ kind: "next_wave", expectedWave: 1, exhaustIfEmpty: false }]);
  });

  it("is exhausted when the last wave is done with no yes", () => {
    expect(plan(referral({ current_wave: 2 }), [attempt({ status: "completed", outcome: "declined" })])).toEqual([{ kind: "exhaust" }]);
  });

  it("releases unchosen yeses once confirmed and flags an expired hold", () => {
    const chosen = attempt({ outcome: "accepted", status: "completed" });
    const other = attempt({ facility_id: "f2", outcome: "accepted", status: "completed" });
    const r = referral({ status: "confirmed", selected_attempt_id: chosen.id, first_acceptance_at: ago(50), hold_expires_at: ago(1) });
    expect(plan(r, [chosen, other])).toEqual([{ kind: "release", attempt: other }, { kind: "hold_expired" }]);
  });
});

describe("planRedial", () => {
  const contacts = new Map([["f1", [contact()]]]);

  it("moves to the next number after a second busy on the same number", () => {
    const first = attempt({ status: "busy", ended_at: ago(60) });
    const second = attempt({ status: "busy", parent_attempt_id: first.id, ended_at: ago(60) });
    expect(planRedial(second, [first, second], contacts, NOW)?.target).toEqual({ to_number: "+912", contact_id: "c2" });
  });

  it("tries the next number at once on no answer, and gives up without one", () => {
    const missed = attempt({ status: "no_answer" });
    expect(planRedial(missed, [missed], contacts, NOW)).toMatchObject({ due: true, reason: "no_answer" });
    expect(planRedial(missed, [missed], new Map(), NOW)).toBeNull();
  });

  it("calls back when the desk asked, and stops after two redials", () => {
    const due = attempt({ outcome: "callback_later", callback_due_at: ago(1), status: "completed" });
    expect(planRedial(due, [due], contacts, NOW)).toMatchObject({ due: true, reason: "callback" });
    const r1 = attempt({ parent_attempt_id: "x", status: "completed" });
    const r2 = attempt({ parent_attempt_id: "y", status: "completed" });
    expect(planRedial(due, [due, r1, r2], contacts, NOW)).toBeNull();
  });
});

describe("function and webhook helpers", () => {
  it("answers a late yes on the same call, and a contradictory one with a check", () => {
    const placed = referral({ status: "confirmed", selected_attempt_id: "other" });
    expect(lateYesReason(placed, "a1")).toBe("placed_elsewhere");
    expect(lateYesReason(referral({ status: "cancelled" }), "a1")).toBe("no_longer_needed");
    const late = responsePlan({ outcome: "accepted", contradictory: false, late: "placed_elsewhere", doctor: "Dr. Rao", alternate: null, recorded: true });
    expect(late.releaseInCall).toBe(true);
    const check = responsePlan({ outcome: "accepted", contradictory: true, late: "placed_elsewhere", doctor: "Dr. Rao", alternate: null, recorded: true });
    expect([check.releaseInCall, check.instruction]).toEqual([false, "Thank them, say Dr. Rao's team will call back to check the bed, and end the call."]);
    expect(responsePlan({ outcome: "redirected", contradictory: false, late: null, doctor: "x", alternate: "+913", recorded: true }).redialTo).toBe("+913");
  });

  const extracted = (outcome: string, confidence: string, bed = "icu") => ({
    "Referral outcome": {
      availability_outcome: { objective: outcome, confidence_label: confidence },
      bed_type: { objective: bed, confidence_label: confidence },
    },
  });

  it("reads a completed call: confident answers are used, anything doubtful is unclear", () => {
    expect(readAvailability(attempt({ extracted_data: extracted("accepted", "High") }), {})).toMatchObject({ kind: "outcome", outcome: "accepted" });
    expect(readAvailability(attempt({ extracted_data: extracted("accepted", "low") }), {})).toMatchObject({ outcome: "unclear" });
    // A confident yes with no bed is never recorded as accepted (CLAUDE.md rule 10): "none" must survive clean().
    expect(readAvailability(attempt({ extracted_data: extracted("accepted", "high", "none") }), {})).toMatchObject({ outcome: "unclear" });
    const bare = { "Referral outcome": { availability_outcome: { objective: "accepted", confidence_label: "high" }, bed_type: "none" } };
    expect(readAvailability(attempt({ extracted_data: bare }), {})).toMatchObject({ outcome: "unclear" });
    expect(readAvailability(attempt({ termination_reason: "voicemail_reached" }), {})).toMatchObject({ outcome: "ivr_blocked" });
  });

  it("flags a disagreement about the yes for review, unless the doctor recorded it", () => {
    const answered = attempt({ outcome: "accepted", outcome_source: "function", extracted_data: extracted("declined", "high") });
    expect(readAvailability(answered, {})).toEqual({ kind: "answered", extractionOutcome: "declined", review: true });
    expect(readAvailability({ ...answered, outcome_source: "manual" }, {})).toMatchObject({ review: false });
  });
});
