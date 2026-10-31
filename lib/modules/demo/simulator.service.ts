import "server-only";
import scenarioJson from "@/scenarios/demo-krait-bite.json";
import { isSimulatedExecution } from "@/lib/integrations/bolna/bolna.client";
import { secondsBetween } from "@/lib/core/clock";
import { canTransition, isTerminal, mapBolnaStatus } from "@/lib/modules/call/status.helper";
import type { Attempt } from "@/lib/core/types";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { FunctionService } from "@/lib/modules/call/function.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { WebhookService } from "@/lib/modules/call/webhook.service";

// Replays scripted calls through the same handlers as real webhooks and function calls, with
// outcome_source = 'simulation'. Step times are seconds after the call was dispatched.
// State lives in the database (attempt status and outcome), so it works across serverless invocations.

export interface Step {
  at_s: number;
  status?: string;
  termination_reason?: string;
  function?: "record-response" | "request-doctor" | "request-callback" | "record-hold";
  params?: Record<string, string>;
}

interface Scenario {
  referral: Record<string, unknown>;
  availability: Record<string, { facility: string; steps: Step[] }>;
  hold_confirm: { steps: Step[] };
  release: { steps: Step[] };
  doctor_selects: { facility_id: string };
}

export const scenario = scenarioJson as unknown as Scenario;

/** Hospitals not in the script decline politely, so any referral can be simulated. */
const DEFAULT_AVAILABILITY: Step[] = [
  { at_s: 3, status: "ringing" },
  { at_s: 8, status: "in-progress" },
  { at_s: 24, function: "record-response", params: { outcome: "declined", bed_type: "none", decline_reason: "full: no bed free right now" } },
  { at_s: 27, status: "call-disconnected" },
  { at_s: 30, status: "completed", termination_reason: "agent_ended_call" },
];

/** Redials and callbacks reach someone who can now say yes. */
const REDIAL_AVAILABILITY: Step[] = [
  { at_s: 3, status: "ringing" },
  { at_s: 7, status: "in-progress" },
  { at_s: 22, function: "record-response", params: { outcome: "accepted", bed_type: "icu", specialist_available: "on_call", ready_in_minutes: "15", contact_person: "Duty doctor" } },
  { at_s: 26, status: "call-disconnected" },
  { at_s: 29, status: "completed", termination_reason: "agent_ended_call" },
];

export function scriptFor(a: Attempt): Step[] {
  if (a.purpose === "hold_confirm") return scenario.hold_confirm.steps;
  if (a.purpose === "release" || a.purpose === "family_update") return scenario.release.steps;
  if (a.parent_attempt_id) return REDIAL_AVAILABILITY;
  return (a.facility_id && scenario.availability[a.facility_id]?.steps) || DEFAULT_AVAILABILITY;
}

function transcriptFor(steps: Step[]): string {
  const lines = ["(Simulated call: no audio was recorded.)", "Agent: Hello, this is an automated assistant calling about an emergency referral. This call is recorded."];
  for (const s of steps) {
    const p = s.params ?? {};
    if (s.function === "record-response") {
      if (p.outcome === "accepted" || p.outcome === "conditional") {
        lines.push(`Desk: Yes, we can take the patient.${p.ready_in_minutes ? ` Ready in ${p.ready_in_minutes} minutes.` : ""}${p.contact_person ? ` Ask for ${p.contact_person}.` : ""}${p.conditions ? ` Please ${p.conditions}.` : ""}`);
        lines.push("Agent: Thank you. I've read that back and noted it.");
      } else if (p.outcome === "declined") {
        lines.push(`Desk: Sorry, we can't take the patient now (${p.decline_reason ?? "no bed"}).`);
      }
    }
    if (s.function === "request-doctor") lines.push(`Desk: I need to talk to the doctor first: ${p.reason ?? ""}.`);
    if (s.function === "request-callback") lines.push(`Desk: Call me back in ${p.minutes ?? "a few"} minutes.`);
    if (s.function === "record-hold") lines.push(`Desk: Yes, we'll keep the bed ready. Ask for ${p.contact_person ?? "the desk"}.`);
  }
  return lines.join("\n");
}

function extractedFor(steps: Step[]): Record<string, unknown> | null {
  const fn = steps.find((s) => s.function === "record-response");
  if (!fn?.params?.outcome) return null;
  return { "Referral outcome": { availability_outcome: { objective: fn.params.outcome, confidence_label: "High" } } };
}

async function applyStep(a: Attempt, step: Step, steps: Step[]): Promise<boolean> {
  if (step.status) {
    const mapped = mapBolnaStatus(step.status);
    if (!mapped || !canTransition(a.status, mapped.status)) return false;
    const completed = mapped.status === "completed";
    const res = await WebhookService.handle(
      {
        id: a.bolna_execution_id,
        status: step.status,
        termination_reason: step.termination_reason ?? null,
        transcript: completed ? transcriptFor(steps) : null,
        telephony_data: { recording_url: null },
        extracted_data: completed && a.purpose === "availability" ? extractedFor(steps) : null,
        context_details: { recipient_data: { attempt_id: a.id } },
      },
      { log: false },
    );
    await res.followUp();
    return res.applied;
  }
  if (step.function) {
    if (a.outcome || isTerminal(a.status)) return false;
    const params = { ...step.params, attempt_id: a.id, to_number: a.to_number };
    const handler = {
      "record-response": FunctionService.recordResponse,
      "request-doctor": FunctionService.requestDoctor,
      "request-callback": FunctionService.requestCallback,
      "record-hold": FunctionService.recordHold,
    }[step.function];
    const res = await handler(params, "simulation");
    await res.followUp();
    return true;
  }
  return false;
}

/** Applies every scripted step that is due. Safe to call repeatedly (each step is applied at most once). */
export async function advanceSimulation(referralId: string): Promise<number> {
  const r = await ReferralRepository.get(referralId);
  if (!r?.is_simulated) return 0;
  let applied = 0;
  const attempts = (await CallRepository.listForReferral(referralId)).filter(
    (a) => isSimulatedExecution(a.bolna_execution_id) && a.dispatched_at && !isTerminal(a.status),
  );
  for (const initial of attempts) {
    const steps = scriptFor(initial);
    const elapsed = secondsBetween(initial.dispatched_at);
    for (const step of steps.filter((s) => s.at_s <= elapsed)) {
      const current = await CallRepository.get(initial.id); // re-read: earlier steps change status and outcome
      if (!current || isTerminal(current.status)) break;
      if (await applyStep(current, step, steps)) applied++;
    }
  }
  return applied;
}
