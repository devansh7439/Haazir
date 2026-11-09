// Fills a local embedded database with fictional referrals so the console has something to show in a presentation.
//   bun run db:demo-history            → replaces the fictional rows (ids starting dddddddd-)
//   bun run db:demo-history -- --remove → removes them
// Stop the server first: PGlite allows one process. Refuses any database but pglite:, and every referral is is_demo.
// It places no calls, and fails if the real planner would place one for any row it wrote.
import { connect, q, setDb } from "../lib/core/db";
import { CallRepository } from "../lib/modules/call/call.repository";
import { FacilityRepository } from "../lib/modules/facility/facility.repository";
import { planEvaluation } from "../lib/modules/referral/referral.helper";
import { ReferralRepository } from "../lib/modules/referral/referral.repository";
import { buildShortSummary } from "../lib/modules/referral/summary.helper";

type Row = Record<string, unknown>;
type Acuity = "critical" | "serious" | "stable";

const NOW = Date.now();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const iso = (ms: number) => new Date(ms).toISOString();

let seq = 0;
const fakeId = () => `dddddddd-0000-4000-8000-${(++seq).toString(16).padStart(12, "0")}`;

// A fixed seed, so every run tells the same story.
let state = 20261109;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (a: number, b: number) => Math.round(a + rand() * (b - a));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

/** Travel from the demo PHC, nearest first. The numbers are the directory's placeholders, never a real desk. */
const HOSPITALS: Record<string, { id: string; eta: number; km: number; phone: string; lang: string }> = {
  tamarind: { id: "00000000-0000-4000-8000-000000000103", eta: 18, km: 9, phone: "+910000000103", lang: "kn" },
  banyan: { id: "00000000-0000-4000-8000-000000000101", eta: 35, km: 21, phone: "+910000000101", lang: "en" },
  neem: { id: "00000000-0000-4000-8000-000000000102", eta: 37, km: 23, phone: "+910000000102", lang: "en" },
  peepal: { id: "00000000-0000-4000-8000-000000000107", eta: 42, km: 27, phone: "+910000000107", lang: "en" },
  jasmine: { id: "00000000-0000-4000-8000-000000000105", eta: 46, km: 29, phone: "+910000000105", lang: "en" },
  mango: { id: "00000000-0000-4000-8000-000000000104", eta: 55, km: 36, phone: "+910000000104", lang: "en" },
  lotus: { id: "00000000-0000-4000-8000-000000000106", eta: 74, km: 48, phone: "+910000000106", lang: "en" },
};
type HospitalKey = keyof typeof HOSPITALS;
const ORIGIN = "00000000-0000-4000-8000-000000000100";
const RAO = "00000000-0000-4000-8000-000000000201";

const DOCTORS = [
  { name: "Dr. Arjun Nair (Demo)", phone: "+910000000202" },
  { name: "Dr. Farah Khan (Demo)", phone: "+910000000203" },
  { name: "Dr. Suresh Gowda (Demo)", phone: "+910000000204" },
];

const CASES: Array<{ type: string; at: HospitalKey[]; weight: number }> = [
  { type: "snakebite_neuro", at: ["tamarind", "banyan", "neem", "jasmine", "mango", "lotus"], weight: 5 },
  { type: "poisoning", at: ["tamarind", "banyan", "neem", "jasmine", "mango"], weight: 4 },
  { type: "stemi", at: ["banyan", "jasmine", "mango"], weight: 5 },
  { type: "head_injury", at: ["neem", "banyan", "mango"], weight: 4 },
  { type: "polytrauma", at: ["neem", "banyan", "mango"], weight: 4 },
  { type: "obstetric_bleed", at: ["tamarind", "peepal", "mango"], weight: 3 },
  { type: "preterm_newborn", at: ["peepal", "mango"], weight: 2 },
  { type: "major_burns", at: ["lotus", "mango"], weight: 2 },
];

const CONTACTS = ["ICU registrar", "Casualty medical officer", "Duty doctor", "Dr. Kamath", "Dr. Iyer", "Nurse in charge"];
const DECLINES = ["ICU full", "All ventilators in use", "Specialist not on call tonight", "CT is down", "No bed until morning"];
const CONDITIONS = ["Bed free in 20 minutes", "Family must arrange blood", "Call again when the ambulance leaves", "Bring the ECG and last reports"];

const insert = async (table: string, row: Row): Promise<void> => {
  const keys = Object.keys(row);
  const values = keys.map((k) => row[k]);
  const slots = keys.map((k, i) => `$${i + 1}${k === "payload" || k === "rank_reasons" ? "::jsonb" : ""}`);
  await q(`insert into ${table} (${keys.join(", ")}) values (${slots.join(", ")})`, values);
};

const event = (referralId: string, attemptId: string | null, type: string, at: number, payload: Row = {}) =>
  insert("events", { referral_id: referralId, attempt_id: attemptId, type, payload: JSON.stringify(payload), created_at: iso(at) });

/** One finished call and the events the timeline reads. Returns the attempt's id. */
const call = async (
  referralId: string,
  key: HospitalKey,
  contactIds: Map<string, string>,
  o: { purpose?: string; parent?: string | null; wave?: number; rank?: number; at: number; status?: string; outcome?: string | null; extra?: Row },
): Promise<{ id: string; outcomeAt: number }> => {
  const h = HOSPITALS[key];
  const id = fakeId();
  const status = o.status ?? "completed";
  const answered = status === "completed";
  const answerAt = o.at + between(9, 32) * 1000;
  const outcomeAt = answerAt + between(32, 85) * 1000;
  const duration = answered ? Math.round((outcomeAt - answerAt) / 1000) + between(6, 18) : 0;
  await insert("call_attempts", {
    id, referral_id: referralId, facility_id: h.id, contact_id: contactIds.get(h.id) ?? null, parent_attempt_id: o.parent ?? null,
    purpose: o.purpose ?? "availability", wave: o.wave ?? 1, rank: o.rank ?? 1, distance_km: h.km, eta_minutes: h.eta,
    rank_reasons: JSON.stringify([`${h.eta} min away`]), to_number: h.phone, call_language: h.lang, status,
    termination_reason: status === "no_answer" ? "no_answer" : status === "busy" ? "busy" : "user_hung_up",
    outcome: o.outcome ?? null, outcome_source: o.outcome ? "function" : null, cost: answered ? +(duration * 0.12).toFixed(2) : 0, duration_s: duration,
    dispatched_at: iso(o.at), answered_at: answered ? iso(answerAt) : null, outcome_at: o.outcome ? iso(outcomeAt) : null,
    ended_at: iso(answered ? outcomeAt + 8000 : o.at + 30_000), created_at: iso(o.at), ...o.extra,
  });
  if (answered) await event(referralId, id, "call_answered", answerAt, { purpose: o.purpose ?? "availability", facility_id: h.id });
  else await event(referralId, id, "call_ended", o.at + 30_000, { status, purpose: "availability", facility_id: h.id });
  if ((o.purpose ?? "availability") === "availability" && o.outcome) {
    await event(referralId, id, "outcome_recorded", outcomeAt, { outcome: o.outcome, source: "function", facility_id: h.id });
  }
  return { id, outcomeAt };
};

const answerFields = (outcome: string): Row => {
  if (outcome === "accepted") return { bed_type: pick(["icu", "icu", "hdu"]), specialist_available: "yes", contact_person: pick(CONTACTS) };
  if (outcome === "conditional") return { bed_type: pick(["icu", "hdu"]), conditions: pick(CONDITIONS), contact_person: pick(CONTACTS), ready_in_minutes: between(15, 30) };
  if (outcome === "declined") return { decline_reason: pick(DECLINES) };
  return {};
};

const main = async () => {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("pglite:")) throw new Error("Only for the local embedded database (DATABASE_URL=pglite:…).");
  const db = await connect(url);
  setDb(db);

  await q(`delete from referrals where id::text like 'dddddddd-%'`);
  await q(`delete from referrers where id::text like 'dddddddd-%'`);
  if (process.argv.includes("--remove")) {
    console.log("Removed the fictional rows.");
    await db.close();
    return;
  }

  const [{ org_id: org, lat, lng }] = await q<{ org_id: string; lat: number; lng: number }>(`select org_id, lat, lng from facilities where id = $1`, [ORIGIN]);
  const contactRows = await q<{ id: string; facility_id: string }>(`select id, facility_id from facility_contacts order by priority desc`);
  const contactIds = new Map(contactRows.map((c) => [c.facility_id, c.id]));
  const templates = await q<Row & { case_type: string; spoken_en: string }>(`select * from case_templates`);
  const needsOf = (t: Row) => (Object.values(t).find(Array.isArray) ?? []) as string[];

  const doctors = [RAO];
  for (const d of DOCTORS) {
    const id = fakeId();
    await insert("referrers", { id, org_id: org, name: d.name, phone_e164: d.phone, facility_id: ORIGIN, languages: ["en", "hi"], verification_status: "verified", verified_at: iso(NOW - 30 * DAY) });
    doctors.push(id);
  }

  const referral = async (o: { type: string; acuity: Acuity; created: number; age?: number; sex?: string; note?: string | null; extra?: Row }) => {
    const t = templates.find((x) => x.case_type === o.type);
    if (!t) throw new Error(`No template for ${o.type}`);
    const id = fakeId();
    const newborn = o.type === "preterm_newborn";
    const age = newborn ? between(1, 9) : o.age ?? between(19, 72);
    const unit = newborn ? "days" : "years";
    const sex = o.type === "obstetric_bleed" ? "female" : o.sex ?? pick(["male", "male", "female"]);
    await insert("referrals", {
      id, org_id: org, status: "searching", referrer_id: pick(doctors), origin_facility_id: ORIGIN, origin_lat: lat, origin_lng: lng,
      case_type: o.type, acuity: o.acuity, age_value: age, age_unit: unit, sex, note: o.note ?? null, required_capabilities: needsOf(t),
      spoken_summary: `${buildShortSummary({ age_value: age, age_unit: unit, sex, case_spoken: t.spoken_en, acuity: o.acuity } as Parameters<typeof buildShortSummary>[0])}.`.replace(/^./, (c) => c.toUpperCase()),
      transport: "ambulance", search_radius_km: 60, current_wave: 1, wave_started_at: iso(o.created + 3000), airway: pick(["own", "own", "intubated"]),
      spo2: between(86, 98), gcs: between(9, 15), on_oxygen: rand() < 0.6, payer: pick(["free_govt", "pmjay", "insurance", "cash"]), is_demo: true, created_at: iso(o.created), ...o.extra,
    });
    await event(id, null, "referral_created", o.created, { acuity: o.acuity, case_type: o.type });
    return id;
  };

  const finish = (id: string, fields: Row) => {
    const keys = Object.keys(fields);
    return q(`update referrals set ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`, [id, ...keys.map((k) => fields[k])]);
  };

  /** Asks each hospital in turn; the yeses are returned so the caller can place or release them. */
  const search = async (id: string, hospitals: HospitalKey[], created: number, wave: number, startAt: number) => {
    await event(id, null, "wave_dispatched", startAt, { wave, facility_ids: hospitals.map((k) => HOSPITALS[k].id) });
    const yes: Array<{ id: string; key: HospitalKey; outcomeAt: number }> = [];
    for (const [i, key] of hospitals.entries()) {
      const r = rand();
      const outcome = r < 0.4 ? "accepted" : r < 0.54 ? "conditional" : r < 0.78 ? "declined" : null;
      const status = outcome ? "completed" : r < 0.94 ? "no_answer" : "busy";
      const review = outcome === "accepted" && rand() < 0.07;
      const c = await call(id, key, contactIds, {
        wave, rank: i + 1, at: startAt + i * 1200, status, outcome,
        extra: { ...(outcome ? answerFields(outcome) : {}), ...(review ? { needs_review: true, extraction_outcome: "declined" } : {}) },
      });
      if (outcome === "accepted" || outcome === "conditional") yes.push({ id: c.id, key, outcomeAt: c.outcomeAt });
    }
    return { yes, last: created };
  };

  const release = async (id: string, y: { id: string; key: HospitalKey }, at: number) => {
    await event(id, y.id, "release_dispatched", at, { facility_id: HOSPITALS[y.key].id });
    await call(id, y.key, contactIds, { purpose: "release", parent: y.id, at, outcome: "release_ack" });
  };

  // History: finished referrals older than a day, which the background loop never touches.
  const HISTORY = 46;
  const weighted = CASES.flatMap((c) => Array<(typeof CASES)[number]>(c.weight).fill(c));
  for (let i = 0; i < HISTORY; i++) {
    const c = pick(weighted);
    const day = 1.3 + (i / HISTORY) * 20 + rand() * 0.4;
    const created = NOW - day * DAY;
    const acuity: Acuity = pick(["critical", "critical", "serious", "serious", "stable"]);
    const id = await referral({ type: c.type, acuity, created });
    const width = acuity === "critical" ? 3 : acuity === "serious" ? 2 : 1;
    let { yes } = await search(id, c.at.slice(0, width), created, 1, created + 3000);
    let wave = 1;
    if (yes.length === 0 && c.at.length > width) {
      wave = 2;
      ({ yes } = await search(id, c.at.slice(width), created, 2, created + 155_000));
    }
    if (yes.length === 0) {
      const at = created + between(6, 11) * MIN;
      await event(id, null, "referral_exhausted", at - MIN, { reason: "all waves finished with no acceptance" });
      await event(id, null, "referral_closed", at, { reason: "transferred_elsewhere" });
      await finish(id, { status: "closed", current_wave: wave, closed_at: iso(at), close_reason: "transferred_elsewhere" });
      continue;
    }
    yes.sort((a, b) => a.outcomeAt - b.outcomeAt);
    const firstYes = yes[0];
    await event(id, firstYes.id, "options_ready", firstYes.outcomeAt, { facility_id: HOSPITALS[firstYes.key].id, ttfa_seconds: Math.floor((firstYes.outcomeAt - created) / 1000) });

    if (rand() < 0.08) {
      const at = firstYes.outcomeAt + between(1, 4) * MIN;
      await event(id, null, "referral_cancelled", at, {});
      for (const y of yes) await release(id, y, at + 5000);
      await finish(id, { status: "cancelled", current_wave: wave, first_acceptance_at: iso(firstYes.outcomeAt), closed_at: iso(at), close_reason: "Patient stabilised on site" });
      continue;
    }

    const chosen = [...yes].sort((a, b) => HOSPITALS[a.key].eta - HOSPITALS[b.key].eta)[0];
    const eta = HOSPITALS[chosen.key].eta;
    const selectedAt = firstYes.outcomeAt + between(30, 110) * 1000;
    await event(id, chosen.id, "facility_selected", selectedAt, { facility_id: HOSPITALS[chosen.key].id });
    const hold = await call(id, chosen.key, contactIds, { purpose: "hold_confirm", parent: chosen.id, at: selectedAt + 3000, outcome: "hold_confirmed", extra: { contact_person: pick(CONTACTS) } });
    await event(id, hold.id, "hold_confirmed", hold.outcomeAt, { facility_id: HOSPITALS[chosen.key].id });
    for (const y of yes.filter((x) => x.id !== chosen.id)) await release(id, y, hold.outcomeAt + 4000);
    if (rand() < 0.45) {
      const checkAt = hold.outcomeAt + (eta + 10) * MIN;
      await call(id, chosen.key, contactIds, { purpose: "arrival_check", parent: chosen.id, at: checkAt, outcome: rand() < 0.92 ? "arrival_confirmed" : "not_arrived" });
    }
    const closedAt = hold.outcomeAt + (eta + between(4, 14)) * MIN;
    await event(id, null, "referral_closed", closedAt, { reason: "arrived" });
    await finish(id, {
      status: "closed", current_wave: wave, first_acceptance_at: iso(firstYes.outcomeAt), selected_facility_id: HOSPITALS[chosen.key].id, selected_attempt_id: chosen.id,
      confirmed_at: iso(hold.outcomeAt), hold_expires_at: iso(hold.outcomeAt + (eta + 30) * MIN), closed_at: iso(closedAt), close_reason: "arrived",
      treatment_started_at: rand() < 0.7 ? iso(closedAt + between(8, 35) * MIN) : null,
    });
  }

  // Live-looking boards for the queue. Every call on them has ended, so nothing is waiting to dial.
  const live: string[] = [];
  const openBoard = async (o: { type: string; acuity: Acuity; ago: number; age: number; sex: string; note: string | null; calls: Array<{ key: HospitalKey; outcome?: string; status?: string; extra?: Row }> }) => {
    const created = NOW - o.ago * MIN;
    const id = await referral({ type: o.type, acuity: o.acuity, created, age: o.age, sex: o.sex, note: o.note });
    live.push(id);
    await event(id, null, "wave_dispatched", created + 3000, { wave: 1, facility_ids: o.calls.map((c) => HOSPITALS[c.key].id) });
    const out: Array<{ id: string; key: HospitalKey; outcomeAt: number; outcome?: string }> = [];
    for (const [i, c] of o.calls.entries()) {
      const r = await call(id, c.key, contactIds, { rank: i + 1, at: created + 3000 + i * 1200, status: c.status, outcome: c.outcome, extra: { ...(c.outcome ? answerFields(c.outcome) : {}), ...c.extra } });
      out.push({ id: r.id, key: c.key, outcomeAt: r.outcomeAt, outcome: c.outcome });
    }
    const first = out.filter((x) => x.outcome === "accepted" || x.outcome === "conditional").sort((a, b) => a.outcomeAt - b.outcomeAt)[0];
    if (first) await event(id, first.id, "options_ready", first.outcomeAt, { facility_id: HOSPITALS[first.key].id, ttfa_seconds: Math.floor((first.outcomeAt - created) / 1000) });
    return { id, created, out, first };
  };

  const snake = await openBoard({
    type: "snakebite_neuro", acuity: "critical", ago: 5, age: 34, sex: "male", note: "Suspected krait, drooping eyelids, ASV started",
    calls: [
      { key: "tamarind", outcome: "accepted", extra: { bed_type: "icu", contact_person: "Dr. Kamath", specialist_available: "yes", transcript: "assistant: Can you take this patient now?\nuser: Yes, we have one ICU bed and a ventilator free. Ask for Dr. Kamath at casualty." } },
      { key: "banyan", outcome: "conditional", extra: { bed_type: "icu", conditions: "Bed free in 20 minutes", contact_person: "ICU registrar", ready_in_minutes: 20 } },
      { key: "neem", outcome: "declined", extra: { decline_reason: "All ventilators in use" } },
    ],
  });
  await finish(snake.id, { status: "options_ready", first_acceptance_at: iso(snake.first!.outcomeAt) });

  const trauma = await openBoard({
    type: "polytrauma", acuity: "serious", ago: 7, age: 27, sex: "male", note: "Road accident, pelvic pain, BP holding after fluids",
    calls: [
      { key: "neem", outcome: "accepted", extra: { bed_type: "icu", contact_person: "Trauma registrar", specialist_available: "yes" } },
      { key: "banyan", outcome: "needs_doctor" },
    ],
  });
  await event(trauma.id, trauma.out[1].id, "doctor_callback_requested", trauma.out[1].outcomeAt + 1000, { facility_id: HOSPITALS.banyan.id, reason: "Wants the CT findings before agreeing" });
  await finish(trauma.id, { status: "options_ready", first_acceptance_at: iso(trauma.first!.outcomeAt) });

  const heart = await openBoard({
    type: "stemi", acuity: "critical", ago: 3, age: 58, sex: "female", note: "Inferior STEMI on ECG, aspirin given",
    calls: [
      { key: "banyan", outcome: "accepted", extra: { bed_type: "icu", contact_person: "Cardiology fellow", specialist_available: "yes" } },
      { key: "jasmine", outcome: "accepted", extra: { bed_type: "icu", needs_review: true, extraction_outcome: "declined", contact_person: "Duty doctor" } },
    ],
  });
  await finish(heart.id, { status: "options_ready", first_acceptance_at: iso(heart.first!.outcomeAt) });

  // Both capable hospitals declined and none is left, so "widen" has nobody new to call.
  const newborn = await openBoard({
    type: "preterm_newborn", acuity: "critical", ago: 11, age: 2, sex: "female", note: "Born at 31 weeks, grunting",
    calls: [
      { key: "peepal", outcome: "declined", extra: { decline_reason: "NICU full" } },
      { key: "mango", outcome: "declined", extra: { decline_reason: "Neonatal ventilators all in use" } },
    ],
  });
  await event(newborn.id, null, "referral_exhausted", NOW - 6 * MIN, { reason: "all waves finished with no acceptance" });
  await finish(newborn.id, { status: "exhausted", current_wave: 2 });

  const burns = await openBoard({
    type: "major_burns", acuity: "serious", ago: 18, age: 41, sex: "male", note: "Kitchen fire, about 30 percent, chest and arms",
    calls: [
      { key: "lotus", outcome: "accepted", extra: { bed_type: "icu", contact_person: "Burns registrar", specialist_available: "yes" } },
      { key: "mango", outcome: "conditional", extra: { bed_type: "hdu", conditions: "Family must arrange blood", contact_person: "Duty doctor" } },
    ],
  });
  const [lotus, mango] = burns.out;
  const heldFrom = NOW - 9 * MIN;
  await event(burns.id, lotus.id, "facility_selected", heldFrom - 2 * MIN, { facility_id: HOSPITALS.lotus.id });
  const burnsHold = await call(burns.id, "lotus", contactIds, { purpose: "hold_confirm", parent: lotus.id, at: heldFrom - 110_000, outcome: "hold_confirmed", extra: { contact_person: "Burns registrar" } });
  await event(burns.id, burnsHold.id, "hold_confirmed", heldFrom, { facility_id: HOSPITALS.lotus.id, contact_person: "Burns registrar" });
  await release(burns.id, mango, heldFrom + 4000);
  for (const [audience, label, preview] of [
    ["receiving_facility", "hospital", "Haazir pre-arrival note · Man aged 41, major burns, serious · about 30 percent, chest and arms · ETA 74 min · ask for Burns registrar"],
    ["referrer", "you", "Haazir: bed held at Lotus Burns & Plastic Centre. Ask for Burns registrar. ETA 74 min."],
  ] as const) {
    await event(burns.id, null, "handoff_sent", heldFrom + 6000, { audience, label, status: "simulated", to_masked: "+91 ••••• ••104", preview_redacted: preview });
  }
  await finish(burns.id, {
    status: "confirmed", first_acceptance_at: iso(burns.first!.outcomeAt), selected_facility_id: HOSPITALS.lotus.id, selected_attempt_id: lotus.id,
    confirmed_at: iso(heldFrom), hold_expires_at: iso(heldFrom + (74 + 30) * MIN),
  });

  // Hospital call counters follow the calls, so the directory agrees with the history.
  await q(`update facility_contacts c set
             calls_made = (select count(*) from call_attempts a where a.contact_id = c.id and a.purpose = 'availability'),
             calls_answered = (select count(*) from call_attempts a where a.contact_id = c.id and a.purpose = 'availability' and a.answered_at is not null)`);

  // Proof that nothing here can dial: the real planner, now and an hour from now, must plan no call.
  const seeded = await q<{ id: string }>(`select id from referrals where id::text like 'dddddddd-%'`);
  const DIALS = ["release", "redial", "next_wave", "dispatch_hold", "arrival_check"];
  const contacts = await FacilityRepository.contactsByFacility(Object.values(HOSPITALS).map((h) => h.id));
  for (const { id } of seeded) {
    const r = await ReferralRepository.get(id);
    if (!r) throw new Error(`Missing ${id}`);
    const attempts = await CallRepository.listForReferral(id);
    for (const at of [NOW, NOW + 60 * MIN]) {
      const dials = planEvaluation({ referral: r, attempts, contacts }, new Date(at)).filter((s) => DIALS.includes(s.kind));
      if (dials.length) throw new Error(`${r.code} (${r.status}) would dial: ${dials.map((s) => s.kind).join(", ")}`);
    }
  }

  const [counts] = await q<{ referrals: number; calls: number }>(
    `select (select count(*)::int from referrals where id::text like 'dddddddd-%') as referrals,
            (select count(*)::int from call_attempts where id::text like 'dddddddd-%') as calls`,
  );
  console.log(`Wrote ${counts.referrals} referrals and ${counts.calls} calls. Planned dials across all of them: 0.`);
  await db.close();
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
