import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { KRAIT } from "./support/scripted-calls";
import { fakeClock, freshDb } from "./helpers";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { FunctionService } from "@/lib/modules/call/function.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";

// Bugs found while debugging; each test fails on the code before the fix.

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

describe("debug regressions", () => {
  it("the hold call waits until the accepting call has hung up", async () => {
    fakeClock();
    const calls = stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[0];
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "in-progress" })).followUp();
    await FunctionService.recordResponse({ attempt_id: a.id, outcome: "accepted" });
    await HoldService.select(referral.id, a.id); // the desk is still on the line
    expect(calls.filter((c) => c.agent_id === "h")).toHaveLength(0);
    await EvaluationService.evaluate(referral.id);
    expect(calls.filter((c) => c.agent_id === "h")).toHaveLength(0);
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "call-disconnected" })).followUp();
    await EvaluationService.evaluate(referral.id); // a concurrent evaluation must not dial twice
    expect(calls.filter((c) => c.agent_id === "h")).toHaveLength(1);
  });

  it("a hospital that says yes after the referral is closed gets a release call", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const [first, second] = await CallRepository.listForReferral(referral.id);
    await FunctionService.recordResponse({ attempt_id: first.id, outcome: "accepted" });
    await (await HoldService.confirmManually(referral.id, first.id, "Dr K"))();
    await ReferralService.close(referral.id, "arrived", null);
    await (await FunctionService.recordResponse({ attempt_id: second.id, outcome: "accepted" })).followUp();
    const releases = (await CallRepository.listForReferral(referral.id)).filter((x) => x.purpose === "release");
    expect(releases.map((x) => x.parent_attempt_id)).toEqual([second.id]);
  });

  it("refuses live calls when Bolna isn't configured, and a bad attendant number", async () => {
    vi.stubEnv("BOLNA_API_KEY", "");
    await expect(ReferralService.create(KRAIT)).rejects.toMatchObject({ code: "BOLNA_NOT_CONFIGURED" });
    stubBolna();
    const bad = { ...KRAIT, patient: { ...KRAIT.patient, attendant_phone: "12345" } };
    await expect(ReferralService.create(bad)).rejects.toMatchObject({ code: "INVALID_ATTENDANT_PHONE" });
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
    await EvaluationService.evaluate(referral.id);
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
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await expect(ReferralService.widen(referral.id, 80)).rejects.toMatchObject({ code: "NOT_WIDENABLE" });
    expect((await ReferralRepository.get(referral.id))!.status).toBe("searching");
  });
});

describe("a patient's name in free text (CLAUDE.md rule 1)", () => {
  const named = { ...KRAIT, patient: { patient_name: "Ramesh Gowda", attendant_name: "Lakshmi", attendant_phone: "9845012345" } };

  it.each([
    ["the patient's first name", { note: "ramesh found near the field" }],
    ["the patient's surname", { note: "Mr. Gowda is drowsy" }],
    ["the attendant's name", { note: "Lakshmi saw the snake" }],
  ])("refuses a note with %s and calls nobody", async (_what, change) => {
    fakeClock();
    const calls = stubBolna();
    await expect(ReferralService.create({ ...named, ...change })).rejects.toMatchObject({ code: "NOTE_CONTAINS_IDENTIFIER" });
    expect(calls).toHaveLength(0);
    expect(await db.query(`select 1 from referrals`)).toHaveLength(0);
  });

  it("refuses treatment given with the patient's name, which a desk hears if it asks", async () => {
    fakeClock();
    const calls = stubBolna();
    await expect(ReferralService.create({ ...named, treatment_given: "Ramesh had ASV" })).rejects.toMatchObject({
      code: "TREATMENT_CONTAINS_IDENTIFIER",
    });
    expect(calls).toHaveLength(0);
  });

  it("still sends a clean note, and no availability call carries the name", async () => {
    fakeClock();
    const calls = stubBolna();
    await ReferralService.create({ ...named, note: "drowsy, ptosis since 1 hour" });
    expect(calls.length).toBeGreaterThan(0);
    expect(JSON.stringify(calls)).not.toMatch(/ramesh|gowda|lakshmi/i);
  });
});

describe("widening a search", () => {
  // At 25 km only the nearest hospitals qualify, so a widen to 80 km has new ones to call.
  const near = { ...KRAIT, search_radius_km: 25 };

  // Every call ends first: a desk still on a call would be skipped as busy, which would hide what these tests check.
  const exhaustBy = async (referralId: string, outcome: "declined" | "callback_later") => {
    const attempts = (await CallRepository.listForReferral(referralId)).filter((a) => a.purpose === "availability");
    for (const a of attempts) {
      await (await WebhookService.handle({ id: a.bolna_execution_id, status: "completed" })).followUp();
      await CallService.recordManualOutcome(a.id, { outcome });
    }
    await ReferralRepository.update(referralId, { status: "exhausted" });
    return attempts.map((a) => a.facility_id);
  };
  const facilitiesCalled = async (referralId: string) =>
    (await CallRepository.listForReferral(referralId)).filter((a) => a.purpose === "availability").map((a) => a.facility_id);

  it("refuses a radius that is no wider, and leaves the referral as it was", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create({ ...KRAIT, search_radius_km: 80 });
    await exhaustBy(referral.id, "declined");
    await expect(ReferralService.widen(referral.id, 80)).rejects.toMatchObject({ code: "ALREADY_AT_RADIUS" });
    expect((await ReferralRepository.get(referral.id))!.status).toBe("exhausted");
    expect(await db.query(`select 1 from referrals`)).toHaveLength(1);
  });

  it("calls only new hospitals, in the first wave and any later one", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(near);
    const declined = await exhaustBy(referral.id, "declined");
    expect(declined.length).toBeGreaterThan(0);

    const widened = await ReferralService.widen(referral.id, 80);
    const first = await facilitiesCalled(widened.id);
    expect(first.length).toBeGreaterThan(0);
    expect(first.filter((id) => declined.includes(id))).toEqual([]);

    const second = await ReferralRepository.claimWave(widened.id, widened.current_wave);
    await CallService.dispatchWave(await ReferralRepository.context(second!), second!.current_wave);
    expect((await facilitiesCalled(widened.id)).filter((id) => declined.includes(id))).toEqual([]);
  });

  it("tells the doctor when everyone in range has already said no, and rings nobody", async () => {
    fakeClock();
    const calls = stubBolna();
    const { referral } = await ReferralService.create({ ...KRAIT, search_radius_km: 80 });
    await exhaustBy(referral.id, "declined");
    const before = calls.length;
    await expect(ReferralService.widen(referral.id, 300)).rejects.toMatchObject({ code: "NO_NEW_HOSPITALS" });
    expect(calls).toHaveLength(before);
    expect((await ReferralRepository.get(referral.id))!.status).toBe("exhausted");
  });

  it("tries again a hospital that never answered", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(near);
    const unreached = await exhaustBy(referral.id, "callback_later");
    const widened = await ReferralService.widen(referral.id, 80);
    expect(await facilitiesCalled(widened.id)).toEqual(expect.arrayContaining(unreached));
  });
});
