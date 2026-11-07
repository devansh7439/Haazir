import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setClock } from "@/lib/core/clock";
import type { Db } from "@/lib/core/db";
import { setDb } from "@/lib/core/db";
import { NO_HANDOVER_FACTS, type Referral, type Referrer } from "@/lib/core/types";
import { checkRegistration, mayRefer } from "@/lib/modules/auth/registration.helper";
import { RegistrationService } from "@/lib/modules/auth/registration.service";
import type { Session } from "@/lib/modules/auth/session.service";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { clinicalLine, handoverFactsOf } from "@/lib/modules/referral/referral.helper";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { buildSbar, sbarLines } from "@/lib/modules/referral/sbar.helper";
import { SlipService } from "@/lib/modules/referral/slip.service";
import { preArrivalNote, type HandoffFacts } from "@/lib/modules/handoff/message.helper";
import { buildSpokenSummary, describeHandover, describeKnownFacts, hasHandover } from "@/lib/modules/referral/summary.helper";
import { advanceCalls, fakeBolna, KRAIT } from "./support/scripted-calls";
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

const FULL = {
  pregnancy_weeks: 34,
  trauma_mechanism: "road_accident" as const,
  infectious_risk: "airborne" as const,
  treatment_given: "IV fluids, tetanus toxoid",
  blood_group: "B-" as const,
  blood_needed: true,
};
const admin: Session = { uid: null, org: "o1", role: "admin", rid: null, name: null, email: null };

describe("handover facts: what a desk hears", () => {
  it("reads pregnancy, mechanism, infection risk and blood need, and nothing when none were given", () => {
    expect(describeHandover(FULL)).toBe("Pregnant, 34 weeks. Road accident. Airborne infection risk, needs isolation. Needs blood.");
    expect(describeHandover(NO_HANDOVER_FACTS)).toBe("");
    expect(describeHandover(undefined)).toBe("");
    expect(describeHandover({ blood_needed: false, trauma_mechanism: "not_trauma" })).toBe("");
  });

  it("puts them between the vitals and the needs, and leaves the krait summary as it was", () => {
    const base = {
      age_value: 28, age_unit: "years" as const, sex: "female" as const, case_spoken: "a road accident", acuity: "critical" as const,
      note: null, needs_spoken_list: ["a ventilator"],
    };
    expect(buildSpokenSummary({ ...base, facts: { airway: "intubated" }, handover: FULL })).toBe(
      "Woman aged 28, a road accident, critical. Intubated. Pregnant, 34 weeks. Road accident. Airborne infection risk, needs isolation. Needs blood. Needs a ventilator.",
    );
    expect(buildSpokenSummary({ ...base, handover: NO_HANDOVER_FACTS })).toBe(buildSpokenSummary(base));
  });

  it("keeps treatment given and blood group for a desk that asks, and only when something was given", () => {
    expect(hasHandover(NO_HANDOVER_FACTS)).toBe(false);
    expect(hasHandover({ blood_needed: false })).toBe(true);
    const text = describeKnownFacts({}, FULL);
    expect(text).toContain("Treatment given: IV fluids, tetanus toxoid.");
    expect(text).toContain("Blood group: B-. Needs blood: yes.");
    expect(describeKnownFacts({}, NO_HANDOVER_FACTS)).toBe(describeKnownFacts({}));
    expect(describeKnownFacts({}, { ...NO_HANDOVER_FACTS, pregnancy_weeks: 30 })).toContain("Treatment given: not stated.");
  });

  it("adds them to the pre-arrival facts line", () => {
    const facts = { airway: "own" as const, spo2: null, gcs: null, on_oxygen: null, payer: "unknown" as const, medico_legal: null };
    expect(clinicalLine({ ...facts, ...FULL })).toBe(
      "Not intubated · Pregnant, 34 weeks · Road accident · Airborne infection risk · Needs blood (B-) · Given: IV fluids, tetanus toxoid",
    );
    expect(clinicalLine({ ...facts, ...NO_HANDOVER_FACTS, blood_group: "O+" })).toBe("Not intubated · Blood group O+");
    expect(clinicalLine({ ...facts, ...NO_HANDOVER_FACTS })).toBe("Not intubated");
  });

  it("normalises a form: blank treatment is none, gaps stay unknown", () => {
    expect(handoverFactsOf({ treatment_given: "   " })).toEqual(NO_HANDOVER_FACTS);
    expect(handoverFactsOf({ blood_needed: false }).blood_needed).toBe(false);
  });
});

describe("SBAR", () => {
  const input = {
    ...FULL, airway: "intubated" as const, spo2: 88, gcs: 9, on_oxygen: true, payer: "pmjay" as const, medico_legal: false,
    age_value: 28, age_unit: "years" as const, sex: "female" as const, acuity: "critical" as const, note: "BP 90/60", transport: "ambulance",
  };

  it("writes one line per letter from the fields", () => {
    const sbar = buildSbar(input, { case_label: "Road accident", needs_labels: ["ICU with ventilator"], eta_minutes: 18 });
    expect(sbarLines(sbar)).toEqual([
      "S: Woman aged 28, Road accident, critical",
      "B: BP 90/60. Mechanism: road accident. Pregnant, 34 weeks. Infection risk: airborne. Treatment given: IV fluids, tetanus toxoid. Payment: Ayushman Bharat",
      "A: Intubated · SpO2 88% on oxygen · GCS 9",
      "R: Needs ICU with ventilator. Needs blood, group B-. Expected in about 18 min by ambulance",
    ]);
  });

  it("says 'Not stated' where there is nothing, so a gap is not mistaken for a check", () => {
    const empty = { ...input, ...NO_HANDOVER_FACTS, airway: "unknown" as const, spo2: null, gcs: null, on_oxygen: null, payer: "unknown" as const, medico_legal: null, note: null };
    const sbar = buildSbar(empty, { case_label: "Other", needs_labels: [], eta_minutes: null });
    expect(sbar.background).toBe("Not stated");
    expect(sbar.assessment).toBe("Not stated");
    expect(sbar.recommendation).toBe("Not stated");
  });
});

describe("SBAR in the pre-arrival note", () => {
  const facts: HandoffFacts = {
    code: "R-4821", doctor_name: "Dr Meera", doctor_phone: "+919800000201", referring_facility: "PHC Hoskote", patient_name: "Ramesh K.",
    who: "Man aged 34", case_label: "Snakebite", acuity: "critical", note: "Drooping eyelids", needs_labels: ["ICU"], eta_minutes: 18,
    transport: "ambulance", contact_person: null, confirmed_time: "10:05", hospital_name: "Tamarind", hospital_address: null,
    hospital_lat: 13, hospital_lng: 77, desk_number: "+919800000103", bed_type: "icu", conditions: null, hold_until_time: "10:53",
  };

  it("keeps the old Note, Needs and ETA lines when there is no SBAR", () => {
    const body = preArrivalNote(facts).body;
    expect(body).toContain("Patient: Ramesh K. · Man aged 34, Snakebite, critical");
    expect(body).toContain("Note: Drooping eyelids");
    expect(body).not.toContain("S: ");
  });

  it("prints the SBAR in their place, keeps the name on its own line and masks it in the preview", () => {
    const sbar = ["S: Man aged 34, Snakebite, critical", "B: Drooping eyelids", "A: Not stated", "R: Needs ICU"];
    const rendered = preArrivalNote({ ...facts, sbar });
    expect(rendered.body).toContain("Patient: Ramesh K.\nS: Man aged 34, Snakebite, critical\nB: Drooping eyelids\nA: Not stated\nR: Needs ICU");
    expect(rendered.body).not.toContain("Note:");
    expect(rendered.preview_redacted).not.toContain("Ramesh");
    expect(rendered.preview_redacted).toContain("S: Man aged 34");
    expect(rendered.template?.params).toEqual(preArrivalNote(facts).template?.params);
  });
});

describe("handover facts on a referral", () => {
  const FEMALE = { ...KRAIT, sex: "female" as const, ...FULL };

  it("stores them, reads the four to every desk and gives the agent the rest", async () => {
    fakeClock();
    const calls = fakeBolna();
    const { referral } = await ReferralService.create(FEMALE);
    expect(referral).toMatchObject({ pregnancy_weeks: 34, trauma_mechanism: "road_accident", blood_group: "B-", blood_needed: true });
    expect(referral.spoken_summary).toContain("Pregnant, 34 weeks. Road accident. Airborne infection risk, needs isolation. Needs blood.");
    expect(referral.spoken_summary).not.toContain("tetanus");
    const data = calls[0].user_data as Record<string, string>;
    expect(data.known_facts).toContain("Treatment given: IV fluids, tetanus toxoid.");
    expect(data.known_facts).toContain("Blood group: B-.");
  });

  it("rejects a phone number in the treatment text and pregnancy for a male patient", async () => {
    fakeClock();
    fakeBolna();
    await expect(ReferralService.create({ ...KRAIT, treatment_given: "call 98450 12345 for the history" })).rejects.toMatchObject({
      code: "TREATMENT_CONTAINS_IDENTIFIER",
    });
    await expect(ReferralService.create({ ...KRAIT, sex: "male", pregnancy_weeks: 20 })).rejects.toMatchObject({
      code: "PREGNANCY_NOT_APPLICABLE",
    });
  });

  it("keeps the facts when the search is widened", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(FEMALE);
    await ReferralRepository.update(referral.id, { status: "exhausted" });
    const widened = await ReferralService.widen(referral.id, 80);
    expect(widened).toMatchObject({ pregnancy_weeks: 34, blood_group: "B-", treatment_given: "IV fluids, tetanus toxoid" });
  });
});

describe("doctor registration", () => {
  it("tidies a number and council, and rejects what cannot be one", () => {
    expect(checkRegistration(" ka 12345 ", "national medical commission")).toEqual({
      ok: true,
      value: { registration_no: "KA12345", registration_council: "NMC" },
    });
    expect(checkRegistration("KMC/2011/04567", "Karnataka Medical Council")).toMatchObject({ ok: true });
    expect(checkRegistration("12", "NMC")).toMatchObject({ ok: false });
    expect(checkRegistration("12345", "")).toMatchObject({ ok: false });
    expect(checkRegistration("12 34; drop table", "NMC")).toMatchObject({ ok: false });
  });

  it("lets anyone refer unless verification is required", () => {
    expect(mayRefer("unverified", false)).toBe(true);
    expect(mayRefer("unverified", true)).toBe(false);
    expect(mayRefer("pending", true)).toBe(false);
    expect(mayRefer("verified", true)).toBe(true);
  });

  const doctor = async (): Promise<Referrer> => (await ReferralRepository.referrer(IDS.referrer))!;

  it("goes pending on submit, verified on an admin's decision, and pending again when the number changes", async () => {
    fakeClock();
    const own: Session = { ...admin, role: "doctor", rid: IDS.referrer };
    expect((await doctor()).verification_status).toBe("unverified");
    const pending = await RegistrationService.submit(own, await doctor(), { registration_no: "KA 12345", registration_council: "Karnataka Medical Council" });
    expect(pending).toMatchObject({ verification_status: "pending", registration_no: "KA12345" });
    const verified = await RegistrationService.decide(admin, pending, "verified");
    expect(verified).toMatchObject({ verification_status: "verified" });
    expect(verified.verified_at).not.toBeNull();
    const changed = await RegistrationService.submit(own, verified, { registration_no: "KA 99999", registration_council: "NMC" });
    expect(changed).toMatchObject({ verification_status: "pending", verified_at: null });
  });

  it("refuses a doctor verifying anyone, a doctor submitting for someone else, and a decision with no number", async () => {
    fakeClock();
    const other: Session = { ...admin, role: "doctor", rid: "00000000-0000-4000-8000-0000000002ff" };
    await expect(RegistrationService.submit(other, await doctor(), { registration_no: "KA12345", registration_council: "NMC" })).rejects.toMatchObject({
      status: 403,
    });
    await expect(RegistrationService.decide({ ...admin, role: "doctor" }, await doctor(), "verified")).rejects.toMatchObject({ status: 403 });
    await expect(RegistrationService.decide(admin, await doctor(), "verified")).rejects.toMatchObject({ code: "NO_REGISTRATION" });
  });

  it("blocks an unverified doctor only when REQUIRE_VERIFIED_REFERRER is on", async () => {
    fakeClock();
    fakeBolna();
    vi.stubEnv("REQUIRE_VERIFIED_REFERRER", "on");
    await expect(ReferralService.create(KRAIT)).rejects.toMatchObject({ code: "REFERRER_NOT_VERIFIED" });
    await expect(ReferralService.preview(KRAIT)).rejects.toMatchObject({ code: "REFERRER_NOT_VERIFIED" });
    const own: Session = { ...admin, role: "doctor", rid: IDS.referrer };
    await RegistrationService.decide(
      admin,
      await RegistrationService.submit(own, await doctor(), { registration_no: "KA12345", registration_council: "NMC" }),
      "verified",
    );
    const { referral } = await ReferralService.create(KRAIT);
    expect(referral.status).toBe("searching");
  });

  it("lists doctors without their phone numbers", async () => {
    const list = await RegistrationService.list((await doctor()).org_id);
    expect(list.length).toBeGreaterThan(0);
    expect(Object.keys(list[0])).not.toContain("phone_e164");
  });
});

describe("transfer consent and the referral slip", () => {
  /** Runs the krait-bite story until the doctor has chosen Tamarind and the bed is confirmed. */
  async function confirmed(): Promise<Referral> {
    const clock = fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    let selected = false;
    for (let t = 0; t <= 240; t++) {
      await advanceCalls(referral.id);
      await EvaluationService.evaluate(referral.id);
      const r = await ReferralRepository.get(referral.id);
      if (!selected && r!.status === "options_ready" && t >= 45) {
        const a = (await CallRepository.listForReferral(referral.id)).find((x) => x.facility_id === IDS.tamarind && x.purpose === "availability")!;
        await HoldService.select(referral.id, a.id);
        selected = true;
      }
      clock.advance(1);
    }
    return (await ReferralRepository.get(referral.id))!;
  }

  it("records who agreed, when and why, and keeps the reason when only the consent is corrected", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    expect(referral.transfer_consent).toBeNull();
    const first = await SlipService.recordConsent(referral, "attendant", "needs_higher_care");
    expect(first).toMatchObject({ transfer_consent: "attendant", transfer_reason: "needs_higher_care" });
    expect(first.transfer_consent_at).not.toBeNull();
    const second = await SlipService.recordConsent(first, "patient", null);
    expect(second).toMatchObject({ transfer_consent: "patient", transfer_reason: "needs_higher_care" });
    const events = await db.query<{ payload: Record<string, unknown> }>(`select payload from events where referral_id = $1 and type = 'transfer_consent_recorded'`, [referral.id]);
    expect(events).toHaveLength(2);
  });

  it("stores consent given on the form with the referral", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create({ ...KRAIT, transfer_consent: "emergency_waiver", transfer_reason: "service_not_available" });
    expect(referral).toMatchObject({ transfer_consent: "emergency_waiver", transfer_reason: "service_not_available" });
    expect(referral.transfer_consent_at).not.toBeNull();
  });

  it("refuses a slip until a hospital has confirmed", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await expect(SlipService.get(referral)).rejects.toMatchObject({ code: "NO_DESTINATION" });
  });

  it("builds the slip for the chosen hospital with consent and SBAR, and no patient identifier", async () => {
    const r = await confirmed();
    expect(r.status).toBe("confirmed");
    await SlipService.recordConsent(r, "attendant", "service_not_available");
    const slip = await SlipService.get((await ReferralRepository.get(r.id))!);
    expect(slip.code).toBe(r.code);
    expect(slip.to.hospital).toContain("Tamarind");
    expect(slip.consent?.by).toBe("the attendant");
    expect(slip.reason).toBe("Service not available at the referring centre");
    expect(slip.lines[0]).toBe(`Referral slip ${r.code}`);
    expect(slip.lines.some((l) => l.startsWith("S: "))).toBe(true);
    expect(slip.lines.some((l) => l.includes("registration not given"))).toBe(true);
    const [note] = await db.query<{ body: string }>(`select body from messages where referral_id = $1 and audience = 'receiving_facility'`, [r.id]);
    expect(note.body).toMatch(/\nS: .*\nB: .*\nA: .*\nR: /);
    const text = JSON.stringify(slip);
    const patient = (await ReferralRepository.patient(r.id))!;
    for (const secret of [patient.patient_name, patient.attendant_name, patient.attendant_phone_e164]) {
      if (secret) expect(text).not.toContain(secret);
    }
  });
});

describe("ambulance status", () => {
  it("starts as not requested, records the doctor's taps with an audit event, and refuses once cancelled", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    expect(referral).toMatchObject({ ambulance_status: "not_requested", ambulance_updated_at: null });
    const requested = await ReferralService.recordAmbulance(referral, "requested");
    expect(requested.ambulance_status).toBe("requested");
    expect(requested.ambulance_updated_at).not.toBeNull();
    expect((await ReferralService.recordAmbulance(requested, "dispatched")).ambulance_status).toBe("dispatched");
    const events = await db.query<{ payload: { status: string } }>(`select payload from events where referral_id = $1 and type = 'ambulance_status' order by id`, [referral.id]);
    expect(events.map((e) => e.payload.status)).toEqual(["requested", "dispatched"]);
    await ReferralService.cancel(referral.id, "stabilised");
    await expect(ReferralService.recordAmbulance(referral, "at_patient")).rejects.toMatchObject({ code: "NOT_RECORDABLE" });
  });
});
