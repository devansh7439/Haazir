import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { advanceSimulation, scenario } from "@/lib/simulator";
import { IDS, fakeClock, freshDb } from "./helpers";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { FunctionService } from "@/lib/modules/call/function.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";
import type { ReferralInput } from "@/lib/modules/referral/referral.type";

// Bugs found while debugging; each test fails on the code before the fix.
const KRAIT = scenario.referral as unknown as ReferralInput;

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

function stubBolna() {
  vi.stubEnv("BOLNA_API_KEY", "k");
  vi.stubEnv("BOLNA_AGENT_ID_AVAILABILITY", "a");
  vi.stubEnv("BOLNA_AGENT_ID_HOLD_CONFIRM", "h");
  vi.stubEnv("BOLNA_AGENT_ID_RELEASE", "r");
  const calls: Array<{ agent_id: string; recipient_phone_number: string }> = [];
  let n = 0;
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify({ status: "queued", execution_id: `exec-${++n}` }), { status: 200 });
  }));
  return calls;
}

async function runSim(referralId: string, clock: { advance(s: number): void }, seconds: number) {
  for (let t = 0; t < seconds; t++) {
    await advanceSimulation(referralId);
    await ReferralService.evaluate(referralId);
    clock.advance(1);
  }
}

describe("debug regressions", () => {
  it("simulated calls never count toward a hospital's track record", async () => {
    const clock = fakeClock();
    const { referral } = await ReferralService.create(KRAIT, { simulate: true });
    await runSim(referral.id, clock, 80);
    const [stats] = await db.query<{ availability_calls: number; accepted: number }>(
      `select availability_calls::int, accepted::int from facility_stats where facility_id = $1`, [IDS.banyan],
    );
    expect(stats).toEqual({ availability_calls: 0, accepted: 0 });
    const [contact] = await db.query<{ calls_made: number }>(`select calls_made from facility_contacts where facility_id = $1 and priority = 1`, [IDS.banyan]);
    expect(contact.calls_made).toBe(0);
  });

  it("the hold call waits until the accepting call has hung up", async () => {
    fakeClock();
    const calls = stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[0];
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "in-progress" })).followUp();
    await FunctionService.recordResponse({ attempt_id: a.id, outcome: "accepted" });
    await ReferralService.select(referral.id, a.id); // the desk is still on the line
    expect(calls.filter((c) => c.agent_id === "h")).toHaveLength(0);
    await ReferralService.evaluate(referral.id);
    expect(calls.filter((c) => c.agent_id === "h")).toHaveLength(0);
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "call-disconnected" })).followUp();
    await ReferralService.evaluate(referral.id); // a concurrent evaluation must not dial twice
    expect(calls.filter((c) => c.agent_id === "h")).toHaveLength(1);
  });

  it("a hospital that says yes after the referral is closed gets a release call", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const [first, second] = await CallRepository.listForReferral(referral.id);
    await FunctionService.recordResponse({ attempt_id: first.id, outcome: "accepted" });
    await (await ReferralService.confirmManually(referral.id, first.id, "Dr K"))();
    await ReferralService.close(referral.id, "arrived", null);
    await (await FunctionService.recordResponse({ attempt_id: second.id, outcome: "accepted" })).followUp();
    const releases = (await CallRepository.listForReferral(referral.id)).filter((x) => x.purpose === "release");
    expect(releases.map((x) => x.parent_attempt_id)).toEqual([second.id]);
  });

  it("refuses live calls when Bolna isn't configured, and a bad attendant number", async () => {
    vi.stubEnv("BOLNA_API_KEY", "");
    await expect(ReferralService.create(KRAIT)).rejects.toMatchObject({ code: "BOLNA_NOT_CONFIGURED" });
    const bad = { ...KRAIT, patient: { ...KRAIT.patient, attendant_phone: "12345" } };
    await expect(ReferralService.create(bad, { simulate: true })).rejects.toMatchObject({ code: "INVALID_ATTENDANT_PHONE" });
    expect(await db.query(`select 1 from referrals`)).toHaveLength(0);
  });

  it("a manual 'call back later' schedules the callback", async () => {
    const clock = fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[2];
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "completed" })).followUp();
    const rec = await CallService.recordManualOutcome(a.id, { outcome: "callback_later" });
    expect(rec?.callback_due_at).not.toBeNull();
    clock.advance(5 * 60 + 1);
    await ReferralService.evaluate(referral.id);
    expect((await CallRepository.listForReferral(referral.id)).filter((x) => x.parent_attempt_id === a.id)).toHaveLength(1);
  });

  it("the doctor's manual outcome isn't flagged when the transcript disagrees", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[0];
    await CallService.recordManualOutcome(a.id, { outcome: "accepted", bed_type: "icu" });
    await (await WebhookService.handle({
      id: a.bolna_execution_id, status: "completed",
      extracted_data: { "Referral outcome": { availability_outcome: { objective: "declined", confidence_label: "High" } } },
    })).followUp();
    expect((await CallRepository.listForReferral(referral.id)).find((x) => x.id === a.id)!.needs_review).toBe(false);
  });

  it("widening is only allowed once every call has finished", async () => {
    fakeClock();
    const { referral } = await ReferralService.create(KRAIT, { simulate: true });
    await expect(ReferralService.widen(referral.id, 80)).rejects.toMatchObject({ code: "NOT_WIDENABLE" });
    expect((await ReferralRepository.get(referral.id))!.status).toBe("searching");
  });
});
