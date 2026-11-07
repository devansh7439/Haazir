import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { AnalyticsService } from "@/lib/modules/analytics/analytics.service";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { FunctionService } from "@/lib/modules/call/function.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { KRAIT, advanceCalls, fakeBolna } from "./support/scripted-calls";
import { IDS, fakeClock, freshDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

/** The krait-bite referral played through to Tamarind's bed hold (as in flow.test.ts, in 5-second steps to keep it quick). */
async function confirmedReferral() {
  const clock = fakeClock();
  const calls = fakeBolna();
  const { referral } = await ReferralService.create(KRAIT);
  let selected = false;
  for (let t = 0; t <= 240; t += 5) {
    await advanceCalls(referral.id);
    await EvaluationService.evaluate(referral.id);
    const r = await ReferralRepository.get(referral.id);
    if (!selected && r!.status === "options_ready" && t >= 45) {
      const tamarind = (await CallRepository.listForReferral(referral.id)).find((a) => a.facility_id === IDS.tamarind && a.purpose === "availability")!;
      await HoldService.select(referral.id, tamarind.id);
      selected = true;
    }
    clock.advance(5);
  }
  const r = (await ReferralRepository.get(referral.id))!;
  expect(r.status).toBe("confirmed");
  const chosen = (await CallRepository.get(r.selected_attempt_id!))!;
  const due = new Date(new Date(r.confirmed_at!).getTime() + ((chosen.eta_minutes ?? 0) + 10) * 60_000);
  const goTo = (at: Date) => clock.advance((at.getTime() - clock.now.getTime()) / 1000);
  const arrivalChecks = async () => (await CallRepository.listForReferral(r.id)).filter((a) => a.purpose === "arrival_check");
  return { clock, calls, id: r.id, chosen, due, goTo, arrivalChecks };
}

describe("arrival check", () => {
  it("asks the chosen hospital once, ten minutes after the patient was due", async () => {
    const t = await confirmedReferral();
    vi.stubEnv("BOLNA_AGENT_ID_ARRIVAL", "agent-arrival");
    const before = t.calls.length;

    t.goTo(new Date(t.due.getTime() - 1000));
    expect(await EvaluationService.evaluate(t.id)).not.toContain("arrival_check_dispatched");
    expect(await t.arrivalChecks()).toHaveLength(0);

    t.goTo(t.due);
    expect(await EvaluationService.evaluate(t.id)).toContain("arrival_check_dispatched");
    // Concurrent or repeated evaluations never ring the desk a second time.
    await EvaluationService.evaluate(t.id);
    await EvaluationService.evaluate(t.id);
    const checks = await t.arrivalChecks();
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ facility_id: IDS.tamarind, parent_attempt_id: t.chosen.id, to_number: t.chosen.to_number });

    expect(t.calls).toHaveLength(before + 1);
    const call = t.calls[before] as { agent_id: string; recipient_phone_number: string; user_data: Record<string, string> };
    expect(call).toMatchObject({ agent_id: "agent-arrival", recipient_phone_number: t.chosen.to_number });
    expect(call.user_data).toMatchObject({ attempt_id: checks[0].id, eta_minutes: String(t.chosen.eta_minutes) });
    expect(call.user_data.case_summary_short).toBeTruthy();
    for (const identifier of ["Ramesh", "Lakshmi", "+910000000301"]) expect(JSON.stringify(call)).not.toContain(identifier);
  });

  it("places no call when the arrival agent is not set up", async () => {
    const t = await confirmedReferral();
    t.goTo(t.due);
    await EvaluationService.evaluate(t.id);
    expect(await t.arrivalChecks()).toHaveLength(0);
  });

  it("records the desk's yes once, as an outcome and a timeline event", async () => {
    const t = await confirmedReferral();
    vi.stubEnv("BOLNA_AGENT_ID_ARRIVAL", "agent-arrival");
    t.goTo(t.due);
    await EvaluationService.evaluate(t.id);
    const check = (await t.arrivalChecks())[0];

    const params = { attempt_id: check.id, arrived: "yes", contact_person: "Dr Shashikala", to_number: check.to_number };
    expect((await FunctionService.recordArrival(params)).result).toBe("recorded");
    await FunctionService.recordArrival(params);

    expect(await CallRepository.get(check.id)).toMatchObject({ outcome: "arrival_confirmed", outcome_source: "function", contact_person: "Dr Shashikala" });
    const events = await db.query<{ type: string; payload: { facility_id: string } }>(
      `select type, payload from events where referral_id = $1 and type in ('arrival_check_dispatched','arrival_confirmed','not_arrived')`, [t.id],
    );
    expect(events.map((e) => e.type).sort()).toEqual(["arrival_check_dispatched", "arrival_confirmed"]);
    expect(events.every((e) => e.payload.facility_id === IDS.tamarind)).toBe(true);
  });

  it("records a no as not arrived, and records nothing from an unclear answer", async () => {
    const t = await confirmedReferral();
    vi.stubEnv("BOLNA_AGENT_ID_ARRIVAL", "agent-arrival");
    t.goTo(t.due);
    await EvaluationService.evaluate(t.id);
    const check = (await t.arrivalChecks())[0];

    const unclear = await FunctionService.recordArrival({ attempt_id: check.id, arrived: "maybe", to_number: check.to_number });
    expect(unclear.result).toBe("unclear");
    expect((await CallRepository.get(check.id))!.outcome).toBeNull();

    const no = await FunctionService.recordArrival({ attempt_id: check.id, arrived: "no", to_number: check.to_number });
    expect(no.instruction).toContain("has not arrived");
    expect((await CallRepository.get(check.id))!.outcome).toBe("not_arrived");

    // The doctor is told once, and the bounce shows up in the hospital's analytics.
    await FunctionService.recordArrival({ attempt_id: check.id, arrived: "no", to_number: check.to_number });
    const alerts = await db.query<{ payload: { kind: string; facility_id: string } }>(
      `select payload from events where referral_id = $1 and type = 'alert' and payload->>'kind' = 'not_arrived'`, [t.id],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].payload.facility_id).toBe(IDS.tamarind);
    const org = (await ReferralRepository.get(t.id))!.org_id;
    const tamarind = (await AnalyticsService.hospitalStats(org)).find((h) => h.facility_id === IDS.tamarind)!;
    expect(tamarind).toMatchObject({ arrival_answers: 1, not_arrived: 1 });
    expect(await AnalyticsService.proofStats(org, false)).toMatchObject({ arrival_answers: 1, not_arrived: 1 });
  });

  it("ignores an id for another kind of call", async () => {
    const t = await confirmedReferral();
    const res = await FunctionService.recordArrival({ attempt_id: t.chosen.id, arrived: "yes" });
    expect(res.result).toBe("not_found");
    expect((await CallRepository.get(t.chosen.id))!.outcome).not.toBe("arrival_confirmed");
  });

  it("leaves the outcome empty when the call ends without an answer", async () => {
    const t = await confirmedReferral();
    vi.stubEnv("BOLNA_AGENT_ID_ARRIVAL", "agent-arrival");
    t.goTo(t.due);
    await EvaluationService.evaluate(t.id);
    const check = (await t.arrivalChecks())[0];
    const exec = (await CallRepository.get(check.id))!.bolna_execution_id!;
    for (const status of ["ringing", "in-progress", "call-disconnected"]) await (await WebhookService.handle({ id: exec, status })).followUp();
    await (await WebhookService.handle({ id: exec, status: "completed", transcript: "...", termination_reason: "agent_ended_call" })).followUp();
    expect(await CallRepository.get(check.id)).toMatchObject({ status: "completed", outcome: null });
  });
});
