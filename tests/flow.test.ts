import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { advanceSimulation, scenario } from "@/lib/simulator";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { IDS, fakeClock, freshDb } from "./helpers";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { FacilityService } from "@/lib/modules/facility/facility.service";
import { FunctionService } from "@/lib/modules/call/function.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";
import type { ReferralInput } from "@/lib/modules/referral/referral.type";

const KRAIT = scenario.referral as unknown as ReferralInput;
const NAME_PARTS = ["Ramesh", "Lakshmi", "+910000000301"];

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

/** Stub Bolna's POST /call so the live path runs without telephony; records every request body. */
function stubBolna() {
  vi.stubEnv("BOLNA_API_KEY", "test-key");
  vi.stubEnv("BOLNA_AGENT_ID_AVAILABILITY", "agent-avail");
  vi.stubEnv("BOLNA_AGENT_ID_HOLD_CONFIRM", "agent-hold");
  vi.stubEnv("BOLNA_AGENT_ID_RELEASE", "agent-release");
  const calls: Array<Record<string, unknown>> = [];
  let n = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push(body);
    return new Response(JSON.stringify({ status: "queued", execution_id: `exec-${++n}` }), { status: 200 });
  }));
  return calls;
}

async function completeCall(executionId: string, extracted: unknown = null) {
  for (const status of ["ringing", "in-progress", "call-disconnected"]) {
    await (await WebhookService.handle({ id: executionId, status })).followUp();
  }
  await (await WebhookService.handle({ id: executionId, status: "completed", transcript: "...", extracted_data: extracted, termination_reason: "agent_ended_call" })).followUp();
}

describe("matching on seed data", () => {
  it("returns the six demo hospitals in ETA order", async () => {
    const ranked = await FacilityService.rankEligible(
      { lat: 13.0707, lng: 77.7982, radius_km: 40, needs: ["icu_bed", "ventilator"], origin_id: IDS.hoskote, org_id: DEFAULT_ORG_ID },
      ["ICU bed", "Ventilator"],
    );
    expect(ranked.map((r) => r.name.replace(/ \(Demo\)$/, "").split(" ")[0])).toEqual([
      "Tamarind", "Banyan", "Neem", "Jasmine", "Mango", "Lotus",
    ]);
    expect(ranked.map((r) => r.eta_minutes)).toEqual([18, 35, 37, 46, 55, 74]);
    expect(ranked[0].rank_reasons).toEqual(["18 min away", "has ICU bed + ventilator"]);
    // Banyan's IVR reception line is never chosen over its direct casualty desk.
    expect(ranked[1].contact?.is_ivr).toBe(false);
  });
});

describe("simulated demo-krait-bite referral", () => {
  it("reaches confirmed with exactly two release calls (Banyan, Mango Grove)", async () => {
    const clock = fakeClock();
    const { referral, attempts } = await ReferralService.create(KRAIT, { simulate: true });
    expect(referral.is_simulated).toBe(true);
    expect(attempts).toHaveLength(6);
    expect(attempts.every((a) => a.status === "queued")).toBe(true);

    let selected = false;
    for (let t = 0; t <= 240; t++) {
      await advanceSimulation(referral.id);
      await ReferralService.evaluate(referral.id);
      const r = await ReferralRepository.get(referral.id);
      if (!selected && r!.status === "options_ready" && t >= 45) {
        const tamarind = (await CallRepository.listForReferral(referral.id)).find((a) => a.facility_id === IDS.tamarind && a.purpose === "availability")!;
        expect(tamarind.outcome).toBe("conditional");
        expect((await ReferralService.select(referral.id, tamarind.id)).status).toBe("confirming");
        selected = true;
      }
      clock.advance(1);
    }

    const r = (await ReferralRepository.get(referral.id))!;
    expect(r.status).toBe("confirmed");
    expect(r.selected_facility_id).toBe(IDS.tamarind);
    expect(r.hold_expires_at).not.toBeNull();
    // TTFA = Banyan's yes at 32 s after dispatch.
    expect(Math.round((+new Date(r.first_acceptance_at!) - +new Date(r.created_at)) / 1000)).toBe(32);

    const all = await CallRepository.listForReferral(referral.id);
    const releases = all.filter((a) => a.purpose === "release");
    expect(releases.map((a) => a.facility_id).sort()).toEqual([IDS.banyan, IDS.mango].sort());
    expect(releases.every((a) => a.status === "completed" && a.outcome === "release_ack")).toBe(true);

    const byFacility = (id: string) => all.find((a) => a.facility_id === id && a.purpose === "availability")!;
    expect(byFacility(IDS.neem).outcome).toBe("declined");
    expect(byFacility(IDS.jasmine).outcome).toBe("needs_doctor");
    expect(byFacility(IDS.lotus).status).toBe("no_answer");
    expect(all.some((a) => a.needs_review)).toBe(false);
    expect(all.find((a) => a.purpose === "hold_confirm")!.outcome).toBe("hold_confirmed");

    const messages = await db.query<{ audience: string; status: string; body: string }>(
      `select audience, status, body from messages where referral_id = $1 order by audience`, [referral.id],
    );
    expect(messages.map((m) => m.audience)).toEqual(["family", "receiving_facility", "referrer"]);
    expect(messages.every((m) => m.status === "simulated")).toBe(true);
    // The patient name goes only into the pre-arrival note for the accepting hospital...
    expect(messages.find((m) => m.audience === "receiving_facility")!.body).toContain("Ramesh K. (Demo)");

    // ...and never into anything the browser can read.
    const events = await db.query<{ payload: unknown }>(`select payload from events where referral_id = $1`, [referral.id]);
    const visible = JSON.stringify({ events, all, r });
    for (const part of NAME_PARTS) expect(visible).not.toContain(part);

    const types = (await db.query<{ type: string }>(`select type from events where referral_id = $1`, [referral.id])).map((e) => e.type);
    expect(types.filter((t) => t === "options_ready")).toHaveLength(1);
    expect(types).toContain("doctor_callback_requested");
    expect(types.filter((t) => t === "handoff_sent")).toHaveLength(3);
  });
});

describe("live call path (Bolna stubbed)", () => {
  it("sends no patient identifiers to Bolna and dispatches the wave in parallel", async () => {
    fakeClock();
    const calls = stubBolna();
    const { attempts } = await ReferralService.create(KRAIT);
    expect(calls).toHaveLength(6);
    for (const c of calls) {
      const text = JSON.stringify(c);
      for (const part of NAME_PARTS) expect(text).not.toContain(part);
      expect(c.bypass_call_guardrails).toBe(true);
      expect(c).not.toHaveProperty("retry_config");
      expect(c).not.toHaveProperty("scheduled_at");
    }
    const tamarindCall = calls.find((c) => (c.user_data as Record<string, string>).facility_name === "Tamarind District Hospital")!;
    expect(tamarindCall.agent_data).toEqual({ language: "kn" });
    expect(attempts.every((a) => a.bolna_execution_id === null || a.status === "queued")).toBe(true);
  });

  it("replaying a webhook twice, or out of order, changes nothing", async () => {
    fakeClock();
    stubBolna();
    await ReferralService.create(KRAIT);
    await (await WebhookService.handle({ id: "exec-1", status: "in-progress" })).followUp();
    const once = (await db.query(`select status, answered_at, updated_at from call_attempts where bolna_execution_id = 'exec-1'`))[0];
    const again = await WebhookService.handle({ id: "exec-1", status: "in-progress" });
    const late = await WebhookService.handle({ id: "exec-1", status: "ringing" });
    expect(again.applied).toBe(false);
    expect(late.applied).toBe(false);
    const twice = (await db.query(`select status, answered_at, updated_at from call_attempts where bolna_execution_id = 'exec-1'`))[0];
    expect(twice).toEqual(once);
    expect(once.status).toBe("in_progress");
  });

  it("records an answer mid-call with unreplaced tokens and the to_number fallback", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await (await WebhookService.handle({ id: "exec-2", status: "in-progress" })).followUp();
    const target = (await CallRepository.listForReferral(referral.id)).find((a) => a.bolna_execution_id === "exec-2")!;
    const res = await FunctionService.recordResponse({
      attempt_id: "%(attempt_id)s",
      outcome: "accepted",
      bed_type: "%(bed_type)s",
      ready_in_minutes: "fifteen",
      contact_person: "Dr Kiran",
      conditions: "None",
      to_number: target.to_number,
    });
    expect(res.result).toBe("recorded");
    expect(res.instruction).toContain("Dr. Meera Rao's team");
    const a = (await CallRepository.listForReferral(referral.id)).find((x) => x.id === target.id)!;
    expect(a.outcome).toBe("accepted");
    expect(a.status).toBe("in_progress"); // green while the call is still live
    expect(a.bed_type).toBeNull();
    expect(a.ready_in_minutes).toBe(15);
    expect(a.conditions).toBeNull();
    const r = (await ReferralRepository.get(referral.id))!;
    expect(r.status).toBe("options_ready");
    expect(r.first_acceptance_at).not.toBeNull();
  });

  it("flags needs_review when extraction disagrees, and blocks select without force", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id)).find((x) => x.bolna_execution_id === "exec-3")!;
    await FunctionService.recordResponse({ attempt_id: a.id, outcome: "accepted", bed_type: "icu" });
    await completeCall("exec-3", { "referral outcome": { availability_outcome: { objective: "declined", confidence_label: "High" } } });
    const after = (await CallRepository.listForReferral(referral.id)).find((x) => x.id === a.id)!;
    expect(after.needs_review).toBe(true);
    expect(after.extraction_outcome).toBe("declined");
    await expect(ReferralService.select(referral.id, a.id)).rejects.toMatchObject({ code: "NEEDS_REVIEW" });
  });

  it("uses a confident extraction when the function was never called, else unclear", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await completeCall("exec-4", { "Referral outcome": { availability_outcome: { objective: "declined", confidence_label: "High" }, decline_reason: { objective: "full", confidence_label: "High" } } });
    await completeCall("exec-5", { "Referral outcome": { availability_outcome: { objective: "accepted", confidence_label: "Low" } } });
    const all = await CallRepository.listForReferral(referral.id);
    const four = all.find((x) => x.bolna_execution_id === "exec-4")!;
    const five = all.find((x) => x.bolna_execution_id === "exec-5")!;
    expect(four.outcome).toBe("declined");
    expect(four.outcome_source).toBe("extraction");
    expect(five.outcome).toBe("unclear"); // a low-confidence "accepted" is never recorded as a yes
  });

  it("all six decline → exhausted (no wave 2 candidates within 40 km)", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    for (const a of await CallRepository.listForReferral(referral.id)) {
      await FunctionService.recordResponse({ attempt_id: a.id, outcome: "declined", decline_reason: "full" });
      await completeCall(a.bolna_execution_id!);
    }
    await ReferralService.evaluate(referral.id);
    const r = (await ReferralRepository.get(referral.id))!;
    expect(r.status).toBe("exhausted");
    expect(r.current_wave).toBe(2);
  });

  it("schedules a callback and redials once it is due", async () => {
    const clock = fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[0];
    const res = await FunctionService.requestCallback({ attempt_id: a.id, minutes: "3" });
    expect(res.instruction).toContain("3 minutes");
    await completeCall(a.bolna_execution_id!);
    clock.advance(60);
    await ReferralService.evaluate(referral.id);
    expect((await CallRepository.listForReferral(referral.id)).filter((x) => x.parent_attempt_id === a.id)).toHaveLength(0);
    clock.advance(121);
    await ReferralService.evaluate(referral.id);
    await ReferralService.evaluate(referral.id); // idempotent
    expect((await CallRepository.listForReferral(referral.id)).filter((x) => x.parent_attempt_id === a.id)).toHaveLength(1);
  });

  it("redials once on busy after 45 s", async () => {
    const clock = fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[1];
    await (await WebhookService.handle({ id: a.bolna_execution_id, status: "busy" })).followUp();
    clock.advance(30);
    await ReferralService.evaluate(referral.id);
    expect((await CallRepository.listForReferral(referral.id)).filter((x) => x.parent_attempt_id === a.id)).toHaveLength(0);
    clock.advance(20);
    await ReferralService.evaluate(referral.id);
    const kids = (await CallRepository.listForReferral(referral.id)).filter((x) => x.parent_attempt_id === a.id);
    expect(kids).toHaveLength(1);
    expect(kids[0].to_number).toBe(a.to_number);
  });

  it("raises a doctor-callback event with the desk number and no patient data", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const a = (await CallRepository.listForReferral(referral.id))[3];
    await FunctionService.requestDoctor({ attempt_id: a.id, reason: "is the patient intubated?", contact_person: "Dr Anil", callback_number: "" });
    const [e] = await db.query<{ payload: Record<string, unknown> }>(
      `select payload from events where referral_id = $1 and type = 'doctor_callback_requested'`, [referral.id],
    );
    expect(e.payload.number).toBe(a.to_number);
    expect(e.payload.reason).toBe("is the patient intubated?");
  });

  it("cancel stops queued calls and releases hospitals that accepted", async () => {
    fakeClock();
    stubBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const all = await CallRepository.listForReferral(referral.id);
    await (await WebhookService.handle({ id: all[0].bolna_execution_id, status: "in-progress" })).followUp();
    await FunctionService.recordResponse({ attempt_id: all[0].id, outcome: "accepted" });
    await (await ReferralService.cancel(referral.id, "patient stabilised"))();
    const after = await CallRepository.listForReferral(referral.id);
    expect(after.filter((a) => a.purpose === "release").map((a) => a.parent_attempt_id)).toEqual([all[0].id]);
    expect(after.filter((a) => a.purpose === "availability" && a.status === "canceled")).toHaveLength(5);
  });
});
