import "server-only";
import {
  BUSY_REDIAL_AFTER_S, DEFAULT_RADIUS_KM, HOLD_BUFFER_MIN, MAX_REDIALS_PER_FACILITY, MAX_WAVES, TIMEZONE,
  WAVE_SIZE, WAVE_TIMEOUT_S, env,
} from "./config";
import { BolnaError, makeCall, stopCall } from "./bolna";
import { addMinutes, now, secondsBetween } from "./clock";
import { one, q } from "./db";
import { addEvent, addEventOnce } from "./events";
import { ELIGIBLE_SQL, applyEtaCap, chooseContact, rankFacilities, type EligibleRow, type RankedFacility } from "./matching";
import { bedRequestMessage, doctorConfirmation, familyMessage, preArrivalNote, type HandoffFacts } from "./messages";
import { maskPhone, normalizePhone, redactNumbers } from "./normalize";
import { checkPortalMismatch } from "./portal";
import {
  AppError, casAttemptStatus, getAttempt, getAttempts, getCapabilities, getCaseTemplate, getContact,
  getContactsByFacility, getFacility, getReferral, getReferrer, insertAttempt, updateAttempt, updateReferral,
} from "./repo";
import { isTerminal } from "./statusMap";
import { buildShortSummary, buildSpokenSummary, checkNote, describeWho, joinSpoken } from "./summary";
import type {
  Acuity, AgeUnit, Attempt, Capability, CaseTemplate, Contact, Facility, Referral, Referrer, Sex,
} from "./types";
import { availabilityUserData, familyUserData, holdConfirmUserData, releaseUserData, type CallContext } from "./userData";
import { sendWhatsApp } from "./whatsapp";

// ============================================================ context

export interface ReferralCtx {
  referral: Referral;
  referrer: Referrer;
  origin: Facility | null;
  template: CaseTemplate;
  needs: Capability[];
}

export async function loadCtx(referral: Referral): Promise<ReferralCtx> {
  const [referrer, origin, template, needs] = await Promise.all([
    getReferrer(referral.referrer_id),
    referral.origin_facility_id ? getFacility(referral.origin_facility_id) : Promise.resolve(null),
    getCaseTemplate(referral.case_type),
    getCapabilities(referral.required_capabilities),
  ]);
  if (!referrer || !template) throw new AppError(500, "CONTEXT_MISSING", "Referral context is incomplete");
  return { referral, referrer, origin, template, needs };
}

export const isAcceptance = (a: Attempt) => a.outcome === "accepted" || a.outcome === "conditional";

function shortSummary(ctx: ReferralCtx, includeAcuity = true): string {
  const r = ctx.referral;
  return buildShortSummary(
    { age_value: r.age_value, age_unit: r.age_unit, sex: r.sex, case_spoken: ctx.template.spoken_en, acuity: r.acuity },
    includeAcuity,
  );
}

// ============================================================ matching

export interface MatchParams {
  lat: number;
  lng: number;
  radius_km: number;
  needs: string[];
  origin_id: string | null;
  org_id: string;
}

export async function rankEligible(p: MatchParams, needLabels: string[]): Promise<RankedFacility[]> {
  const rows = await q<EligibleRow>(ELIGIBLE_SQL, [p.lat, p.lng, p.radius_km, p.needs, p.origin_id, p.org_id]);
  if (rows.length === 0) return [];
  const contacts = await getContactsByFacility(rows.map((r) => r.id));
  return rankFacilities(rows, contacts, needLabels);
}

async function suggestionsFor(p: MatchParams, needs: Capability[]): Promise<string[]> {
  const out: string[] = [];
  if (p.radius_km < 80 && (await rankEligible({ ...p, radius_km: 80 }, [])).length > 0) out.push("widen radius to 80 km");
  for (const n of needs) {
    const rest = p.needs.filter((c) => c !== n.code);
    if ((await rankEligible({ ...p, needs: rest }, [])).length > 0) out.push(`remove: ${n.code}`);
  }
  return out;
}

// ============================================================ create / preview

export interface ReferralInput {
  referrer_id: string;
  case_type: string;
  required_capabilities: string[];
  acuity: Acuity;
  age_value?: number | null;
  age_unit?: AgeUnit;
  sex?: Sex;
  note?: string | null;
  transport?: "ambulance" | "private_vehicle" | "unknown";
  search_radius_km?: number;
  origin_lat?: number;
  origin_lng?: number;
  /** Same id = same press of "Find a bed"; a double-click or retry returns the first referral instead of calling twice. */
  client_request_id?: string;
  patient?: {
    patient_name?: string | null;
    attendant_name?: string | null;
    attendant_phone?: string | null;
    attendant_language?: string | null;
  };
}

interface Prepared {
  referrer: Referrer;
  origin: Facility | null;
  template: CaseTemplate;
  needs: Capability[];
  params: MatchParams;
  spoken_summary: string;
  warnings: string[];
  ranked: RankedFacility[];
  skipped_far: number;
}

async function prepare(input: ReferralInput, orgId?: string): Promise<Prepared> {
  const referrer = await getReferrer(input.referrer_id);
  // A referrer from another organisation is reported exactly like a missing one.
  if (!referrer || (orgId && referrer.org_id !== orgId)) throw new AppError(422, "UNKNOWN_REFERRER", "Referrer not found");
  const origin = referrer.facility_id ? await getFacility(referrer.facility_id) : null;
  const lat = origin?.lat ?? input.origin_lat;
  const lng = origin?.lng ?? input.origin_lng;
  if (lat === undefined || lng === undefined) throw new AppError(422, "ORIGIN_REQUIRED", "Origin location is required");
  const template = await getCaseTemplate(input.case_type);
  if (!template) throw new AppError(422, "UNKNOWN_CASE_TYPE", "Unknown case type");
  const codes = [...new Set(input.required_capabilities)];
  const needs = await getCapabilities(codes);
  if (needs.length !== codes.length) {
    const known = new Set(needs.map((n) => n.code));
    throw new AppError(422, "UNKNOWN_CAPABILITY", "Unknown capability", { unknown: codes.filter((c) => !known.has(c)) });
  }
  if (needs.length === 0 && input.case_type !== "other") {
    throw new AppError(422, "NEEDS_REQUIRED", "Choose at least one need");
  }
  const noteCheck = checkNote(input.note);
  if (noteCheck.blocked) {
    throw new AppError(422, "NOTE_CONTAINS_IDENTIFIER", noteCheck.errors[0], { errors: noteCheck.errors });
  }
  const spoken_summary = buildSpokenSummary({
    age_value: input.age_value ?? null,
    age_unit: input.age_unit ?? "years",
    sex: input.sex ?? "unknown",
    case_spoken: template.spoken_en,
    acuity: input.acuity,
    note: input.note,
    needs_spoken_list: needs.map((n) => n.spoken_en),
  });
  const params: MatchParams = {
    lat, lng,
    radius_km: input.search_radius_km ?? DEFAULT_RADIUS_KM,
    needs: codes,
    origin_id: origin?.id ?? null,
    org_id: referrer.org_id,
  };
  const { kept: ranked, skipped } = applyEtaCap(await rankEligible(params, needs.map((n) => n.label)), env.maxEtaMinutes(input.acuity));
  return { referrer, origin, template, needs, params, spoken_summary, warnings: noteCheck.warnings, ranked, skipped_far: skipped };
}

export async function previewReferral(input: ReferralInput, opts: { orgId?: string } = {}) {
  const p = await prepare(input, opts.orgId);
  return {
    spoken_summary: p.spoken_summary,
    warnings: p.warnings,
    wave_size: WAVE_SIZE,
    skipped_far: p.skipped_far,
    max_eta_minutes: env.maxEtaMinutes(input.acuity) || null,
    suggestions: p.ranked.length === 0 ? await suggestionsFor(p.params, p.needs) : [],
    eligible: p.ranked.map((f, i) => ({
      facility_id: f.facility_id,
      name: f.name,
      distance_km: f.distance_km,
      eta_minutes: f.eta_minutes,
      call_language: f.call_language,
      rank_reasons: f.rank_reasons,
      will_call: i < WAVE_SIZE,
    })),
  };
}

async function findByRequestId(orgId: string, requestId: string | undefined) {
  if (!requestId) return null;
  const existing = await one<Referral>(`select * from referrals where org_id = $1 and client_request_id = $2`, [orgId, requestId]);
  return existing ? { referral: existing, attempts: await getAttempts(existing.id), duplicate: true as const } : null;
}

/** Cap on live referrals placing calls at once per organisation (a runaway client can't phone every hospital in town). */
function maxActiveLive(): number {
  return Number(process.env.MAX_ACTIVE_LIVE_REFERRALS) || 10;
}

export async function createReferral(
  input: ReferralInput,
  opts: { simulate?: boolean; orgId?: string } = {},
): Promise<{ referral: Referral; attempts: Attempt[]; duplicate?: true }> {
  const p = await prepare(input, opts.orgId);
  const repeat = await findByRequestId(p.referrer.org_id, input.client_request_id);
  if (repeat) return repeat;
  if (p.ranked.length === 0) {
    throw new AppError(409, "NO_ELIGIBLE_FACILITIES", "No eligible hospital in range", {
      suggestions: await suggestionsFor(p.params, p.needs),
    });
  }
  const simulated = !!opts.simulate || env.simulationMode;
  if (!simulated && (!env.bolnaApiKey || !env.agentId("availability"))) {
    throw new AppError(422, "BOLNA_NOT_CONFIGURED", "Live calls need BOLNA_API_KEY and BOLNA_AGENT_ID_AVAILABILITY. Run it as a simulation instead.");
  }
  if (!simulated) {
    const [active] = await q<{ n: number }>(
      `select count(*)::int as n from referrals
       where org_id = $1 and not is_simulated and status in ('searching','confirming') and created_at > $2`,
      [p.referrer.org_id, new Date(now().getTime() - 2 * 3600_000)],
    );
    if (active.n >= maxActiveLive()) {
      throw new AppError(429, "TOO_MANY_ACTIVE_REFERRALS", `${active.n} referrals are already calling hospitals. Finish or cancel one first.`);
    }
  }
  const attendantPhone = input.patient?.attendant_phone ? normalizePhone(input.patient.attendant_phone) : null;
  if (input.patient?.attendant_phone && !attendantPhone) {
    throw new AppError(422, "INVALID_ATTENDANT_PHONE", "The attendant's phone number doesn't look right. Use a 10-digit mobile number.");
  }
  const t = now();
  const referral = await one<Referral>(
    `insert into referrals
       (status, referrer_id, origin_facility_id, origin_lat, origin_lng, case_type, acuity, age_value, age_unit, sex,
        note, required_capabilities, spoken_summary, transport, search_radius_km, is_simulated, is_demo, created_at, updated_at,
        client_request_id)
     values ('searching', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::text[], $12, $13, $14, $15, $16, $17, $17, $18)
     on conflict (org_id, client_request_id) where client_request_id is not null do nothing
     returning *`,
    [
      p.referrer.id, p.origin?.id ?? null, p.params.lat, p.params.lng, input.case_type, input.acuity,
      input.age_value ?? null, input.age_unit ?? "years", input.sex ?? "unknown", input.note?.trim() || null,
      p.params.needs, p.spoken_summary, input.transport ?? "ambulance", p.params.radius_km, simulated,
      p.origin?.is_demo ?? false, t, input.client_request_id ?? null,
    ],
  );
  if (!referral) {
    // Lost a race with the same request (a double-click): hand back the referral the other request created.
    const raced = await findByRequestId(p.referrer.org_id, input.client_request_id);
    if (raced) return raced;
    throw new AppError(500, "INSERT_FAILED", "Could not create the referral");
  }

  // Identifiers live apart from the referral, server-only.
  const pt = input.patient;
  if (pt && (pt.patient_name || pt.attendant_name || pt.attendant_phone)) {
    await q(
      `insert into patient_details (referral_id, patient_name, attendant_name, attendant_phone_e164, attendant_language, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [referral.id, pt.patient_name || null, pt.attendant_name || null, attendantPhone,
       pt.attendant_language || "en", t],
    );
  }
  await addEvent(referral.id, "referral_created", {
    case_type: referral.case_type,
    acuity: referral.acuity,
    required_capabilities: referral.required_capabilities,
    simulated,
  });

  const claimed = await claimWave(referral.id, 0);
  const ctx = await loadCtx(claimed ?? referral);
  const attempts = claimed ? await dispatchWave(ctx, 1, p.ranked) : [];
  return { referral: claimed ?? referral, attempts };
}

// ============================================================ waves and calls

/** Atomic claim (docs/03-data-model.md §5.4): only one caller can open a given wave. */
export async function claimWave(referralId: string, expectedWave: number): Promise<Referral | null> {
  const t = now();
  return one<Referral>(
    `update referrals set current_wave = current_wave + 1, wave_started_at = $3, updated_at = $3
     where id = $1 and current_wave = $2 returning *`,
    [referralId, expectedWave, t],
  );
}

export async function dispatchWave(ctx: ReferralCtx, wave: number, ranked?: RankedFacility[]): Promise<Attempt[]> {
  const r = ctx.referral;
  const existing = await getAttempts(r.id);
  const called = new Set(existing.filter((a) => a.purpose === "availability").map((a) => a.facility_id));
  const pool = ranked ?? applyEtaCap(
    await rankEligible(
      {
        lat: r.origin_lat, lng: r.origin_lng, radius_km: r.search_radius_km, needs: r.required_capabilities,
        origin_id: r.origin_facility_id, org_id: r.org_id,
      },
      ctx.needs.map((n) => n.label),
    ),
    env.maxEtaMinutes(r.acuity),
  ).kept;
  const pick = pool.filter((f) => !called.has(f.facility_id) && f.contact).slice(0, WAVE_SIZE);
  if (pick.length === 0) return [];
  const offset = called.size;
  const inserted: Attempt[] = [];
  for (const [i, f] of pick.entries()) {
    const a = await insertAttempt({
      referral_id: r.id,
      facility_id: f.facility_id,
      contact_id: f.contact!.id,
      purpose: "availability",
      wave,
      rank: offset + i + 1,
      distance_km: f.distance_km,
      eta_minutes: f.eta_minutes,
      rank_reasons: f.rank_reasons,
      to_number: f.contact!.phone_e164,
      call_language: f.call_language,
    });
    if (a) inserted.push(a);
  }
  await addEvent(r.id, "wave_dispatched", { wave, facility_ids: inserted.map((a) => a.facility_id) });
  // One failed dispatch (e.g. a 400 on a bad number) must not block the rest.
  await Promise.allSettled(inserted.map((a) => dispatchCall(ctx, a)));
  if (env.whatsappAvailabilityPing) await sendBedRequests(ctx, inserted);
  return inserted;
}

/**
 * C6: the same bed request on WhatsApp, for desks that prefer to reply there ("YES R-4821").
 * Sent after the calls are placed, so it never delays them. Carries no patient identifiers.
 */
async function sendBedRequests(ctx: ReferralCtx, attempts: Attempt[]): Promise<void> {
  const facilities = await q<Facility>(`select * from facilities where id = any($1::uuid[])`, [attempts.map((a) => a.facility_id)]);
  const rendered = bedRequestMessage({
    code: ctx.referral.code,
    doctor_name: ctx.referrer.name.replace(/\s*\(Demo\)/i, ""),
    referring_facility: (ctx.origin?.name ?? "").replace(/\s*\(Demo\)/i, ""),
    case_summary: ctx.referral.spoken_summary,
  });
  for (const f of facilities.filter((x) => x.whatsapp_number)) {
    await sendWhatsApp({
      referral_id: ctx.referral.id,
      audience: "availability_ping",
      to: f.whatsapp_number,
      rendered,
      simulated: ctx.referral.is_simulated,
      eventType: "bed_request_sent",
      facilityId: f.id,
    });
  }
}

/** Places one Bolna call for an attempt. Returns false (attempt marked failed) if dispatch fails. */
export async function dispatchCall(
  ctx: ReferralCtx,
  attempt: Attempt,
  opts: { consented_test?: boolean } = {},
): Promise<boolean> {
  const r = ctx.referral;
  const facility = attempt.facility_id ? await getFacility(attempt.facility_id) : null;
  const callCtx: CallContext = {
    attempt_id: attempt.id,
    doctor_name: ctx.referrer.name,
    referring_facility: ctx.origin?.name ?? "the referring centre",
    facility_name: facility?.name ?? "your hospital",
    referral_code: r.code,
    language: attempt.call_language,
    consented_test: opts.consented_test,
  };
  let userData: Record<string, string>;
  let recipient = attempt.to_number;
  if (attempt.purpose === "availability") {
    userData = availabilityUserData(callCtx, {
      case_summary: r.spoken_summary,
      needs_spoken: joinSpoken(ctx.needs.map((n) => n.spoken_en)),
      eta_minutes: attempt.eta_minutes,
    });
  } else if (attempt.purpose === "hold_confirm") {
    const accepted = attempt.parent_attempt_id ? await getAttempt(attempt.parent_attempt_id) : null;
    userData = holdConfirmUserData(callCtx, {
      case_summary_short: shortSummary(ctx),
      bed_type: accepted?.bed_type ?? null,
      accepted_by: accepted?.contact_person ?? null,
      eta_minutes: attempt.eta_minutes,
    });
  } else if (attempt.purpose === "family_update") {
    const patient = await one<{ attendant_name: string | null; attendant_phone_e164: string | null }>(
      `select attendant_name, attendant_phone_e164 from patient_details where referral_id = $1`, [r.id],
    );
    // The attendant's real number stays in patient_details; the attempt row only holds a masked copy.
    recipient = patient?.attendant_phone_e164 ?? "";
    userData = familyUserData(callCtx, {
      attendant_name: patient?.attendant_name ?? null,
      hospital_area: [facility?.address, facility?.city].filter((x) => x && x !== "Demo address").join(", ") || (facility?.name ?? ""),
      eta_minutes: attempt.eta_minutes,
    });
  } else {
    userData = releaseUserData(callCtx, { case_summary_short: shortSummary(ctx, false) });
  }

  const agentId = env.agentId(attempt.purpose);
  try {
    const res = await makeCall(
      {
        agent_id: agentId,
        recipient_phone_number: recipient,
        from_phone_number: env.bolnaFromNumber || undefined,
        user_data: userData,
        agent_data: { language: attempt.call_language },
        bypass_call_guardrails: true,
      },
      { simulate: r.is_simulated },
    );
    await updateAttempt(attempt.id, {
      bolna_execution_id: res.execution_id,
      bolna_agent_id: r.is_simulated ? "simulation" : agentId,
      bolna_status: res.status ?? "queued",
      dispatched_at: now(),
    });
    await addEvent(r.id, "call_queued", { facility_id: attempt.facility_id, purpose: attempt.purpose, status: "queued" }, attempt.id);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await casAttemptStatus(attempt, "failed", { termination_reason: "dispatch_error", ended_at: now() });
    await addEvent(r.id, "alert", {
      kind: err instanceof BolnaError && err.httpStatus === 429 ? "concurrency_or_activation" : "dispatch_failed",
      facility_id: attempt.facility_id,
      // A provider error can echo the number it dialled (for a family call, the attendant's).
      message: redactNumbers(message),
    }, attempt.id);
    return false;
  }
}

async function redial(
  ctx: ReferralCtx,
  parent: Attempt,
  target: { to_number: string; contact_id: string | null },
  reason: string,
): Promise<Attempt | null> {
  const a = await insertAttempt({
    referral_id: parent.referral_id,
    facility_id: parent.facility_id,
    contact_id: target.contact_id,
    parent_attempt_id: parent.id,
    purpose: "availability",
    wave: parent.wave,
    rank: parent.rank,
    distance_km: parent.distance_km,
    eta_minutes: parent.eta_minutes,
    rank_reasons: parent.rank_reasons,
    to_number: target.to_number,
    call_language: parent.call_language,
  });
  if (!a) return null; // someone else already redialed this attempt
  await addEvent(parent.referral_id, "redial_dispatched", { facility_id: parent.facility_id, reason }, a.id);
  await dispatchCall(ctx, a);
  return a;
}

async function dispatchRelease(ctx: ReferralCtx, acceptor: Attempt): Promise<boolean> {
  const a = await insertAttempt({
    referral_id: acceptor.referral_id,
    facility_id: acceptor.facility_id,
    contact_id: acceptor.contact_id,
    parent_attempt_id: acceptor.id,
    purpose: "release",
    wave: acceptor.wave,
    rank: acceptor.rank,
    distance_km: acceptor.distance_km,
    eta_minutes: acceptor.eta_minutes,
    to_number: acceptor.to_number,
    call_language: acceptor.call_language,
  });
  if (!a) return false;
  await addEvent(acceptor.referral_id, "release_dispatched", { facility_id: acceptor.facility_id }, a.id);
  await dispatchCall(ctx, a);
  return true;
}

// ============================================================ evaluate

interface RedialPlan {
  attempt: Attempt;
  target: { to_number: string; contact_id: string | null } | null;
  due: boolean;
  reason: "callback" | "busy" | "no_answer";
}

function planRedial(
  a: Attempt,
  all: Attempt[],
  contacts: Map<string, Contact[]>,
): RedialPlan | null {
  if (all.some((c) => c.parent_attempt_id === a.id && c.purpose === "availability")) return null;
  const sameFacility = all.filter((x) => x.purpose === "availability" && x.facility_id === a.facility_id);
  const redials = sameFacility.filter((x) => x.parent_attempt_id).length;
  const dialled = new Set(sameFacility.map((x) => x.to_number));
  const fcontacts = (a.facility_id && contacts.get(a.facility_id)) || [];
  const alternate = chooseContact(fcontacts, dialled);
  const altTarget = alternate ? { to_number: alternate.phone_e164, contact_id: alternate.id } : null;

  if (a.outcome === "callback_later" && a.callback_due_at) {
    if (redials >= MAX_REDIALS_PER_FACILITY) return null; // handled at request time: the desk is handed to the doctor
    return {
      attempt: a,
      target: { to_number: a.to_number, contact_id: a.contact_id },
      due: secondsBetween(a.callback_due_at) >= 0,
      reason: "callback",
    };
  }
  if (redials >= MAX_REDIALS_PER_FACILITY) return null;
  if (a.status === "busy" && !a.outcome) {
    const parent = a.parent_attempt_id ? all.find((x) => x.id === a.parent_attempt_id) : null;
    // One redial to the same number after 45 s; after that, the next contact.
    const target = parent?.status === "busy" && parent.to_number === a.to_number
      ? altTarget
      : { to_number: a.to_number, contact_id: a.contact_id };
    if (!target) return null;
    return { attempt: a, target, due: secondsBetween(a.ended_at ?? a.updated_at) >= BUSY_REDIAL_AFTER_S, reason: "busy" };
  }
  if (a.status === "no_answer" && !a.outcome && altTarget) {
    return { attempt: a, target: altTarget, due: true, reason: "no_answer" };
  }
  return null;
}

const ACTIVE_REFERRAL = ["searching", "options_ready", "exhausted"];

/** Idempotent: runs after every webhook and function call, and on every console tick. */
export async function evaluateReferral(id: string): Promise<string[]> {
  const actions: string[] = [];
  const r = await getReferral(id);
  if (!r || r.status === "draft" || (r.status === "closed" && r.close_reason === "test_call")) return actions;
  const attempts = await getAttempts(id);
  const avail = attempts.filter((a) => a.purpose === "availability");
  const accepted = avail.filter((a) => isAcceptance(a) && !a.needs_review);
  const anyAcceptance = avail.filter(isAcceptance); // includes answers under review: they may be holding a bed
  const hasRelease = (a: Attempt) => attempts.some((x) => x.purpose === "release" && x.parent_attempt_id === a.id);
  let ctx: ReferralCtx | null = null;
  const getCtx = async () => (ctx ??= await loadCtx(r));

  // Cancelled: release every hospital that said yes, including late answers.
  // Closed: the patient is placed; release anyone (except the chosen hospital) who said yes after that.
  if (r.status === "cancelled" || r.status === "closed") {
    const keep = r.status === "closed" ? r.selected_attempt_id : null;
    for (const a of anyAcceptance.filter((x) => x.id !== keep && !hasRelease(x))) {
      if (await dispatchRelease(await getCtx(), a)) actions.push(`release:${a.facility_id}`);
    }
    return actions;
  }

  // 0. A hold call waits until the accepting call has ended, so it doesn't ring a desk that is still on the line.
  if (r.status === "confirming") {
    for (const h of attempts.filter((x) => x.purpose === "hold_confirm" && x.status === "queued" && !x.bolna_status)) {
      const parent = attempts.find((x) => x.id === h.parent_attempt_id);
      const lineFree = !parent || isTerminal(parent.status) || parent.status === "wrapping_up";
      if (!lineFree && secondsBetween(h.created_at) < HOLD_WAIT_MAX_S) continue;
      if (await dispatchHoldCall(await getCtx(), h)) actions.push("hold_call_dispatched");
    }
  }

  // 1. First acceptance (sets TTFA once)
  if (accepted.length > 0 && !r.first_acceptance_at) {
    const first = [...accepted].sort((a, b) => +new Date(a.outcome_at ?? 0) - +new Date(b.outcome_at ?? 0))[0];
    if (await markFirstAcceptance(r, first)) actions.push("first_acceptance");
  }
  if (accepted.length > 0 && (r.status === "searching" || r.status === "exhausted")) {
    if (await updateReferral(id, { status: "options_ready" }, ["searching", "exhausted"])) actions.push("options_ready");
  }
  if (accepted.length === 0 && r.status === "options_ready") {
    // The only yes was withdrawn (hold declined) or put under review: keep searching.
    if (await updateReferral(id, { status: "searching" }, ["options_ready"])) actions.push("back_to_searching");
    r.status = "searching";
  }

  // 2–3. Due callbacks, one redial on busy, alternate number on no answer
  const contacts = await getContactsByFacility([...new Set(avail.map((a) => a.facility_id).filter((x): x is string => !!x))]);
  const plans = avail.map((a) => planRedial(a, attempts, contacts)).filter((p): p is RedialPlan => !!p);
  if (ACTIVE_REFERRAL.includes(r.status)) {
    for (const p of plans.filter((x) => x.due && x.target)) {
      if (await redial(await getCtx(), p.attempt, p.target!, p.reason)) actions.push(`redial_${p.reason}:${p.attempt.facility_id}`);
    }
  }

  // 4. Next wave, or exhausted
  if (r.status === "searching" && accepted.length === 0) {
    const pending = new Set(plans.map((p) => p.attempt.id));
    const active = avail.filter((a) => !isTerminal(a.status) || pending.has(a.id));
    const waveAge = secondsBetween(r.wave_started_at);
    if ((active.length === 0 || waveAge > WAVE_TIMEOUT_S) && r.current_wave < MAX_WAVES) {
      const claimed = await claimWave(r.id, r.current_wave);
      if (claimed) {
        ctx = await loadCtx(claimed);
        const sent = await dispatchWave(ctx, claimed.current_wave);
        actions.push(`wave_${claimed.current_wave}_dispatched:${sent.length}`);
        if (sent.length === 0 && active.length === 0) await markExhausted(r.id, actions);
      }
    } else if (active.length === 0 && r.current_wave >= MAX_WAVES) {
      await markExhausted(r.id, actions);
    }
  }

  // 5. Release hospitals that accepted but weren't chosen (including late acceptances)
  if (r.status === "confirmed") {
    for (const a of anyAcceptance.filter((x) => x.id !== r.selected_attempt_id && !hasRelease(x))) {
      if (await dispatchRelease(await getCtx(), a)) actions.push(`release:${a.facility_id}`);
    }
  }

  // 6. Hold expiry
  if (r.status === "confirmed" && r.hold_expires_at && secondsBetween(r.hold_expires_at) > 0) {
    if (await addEventOnce(r.id, "hold_expired", { facility_id: r.selected_facility_id })) actions.push("hold_expired");
  }
  return actions;
}

async function markExhausted(id: string, actions: string[]) {
  if (await updateReferral(id, { status: "exhausted" }, ["searching"])) {
    await addEventOnce(id, "referral_exhausted", { reason: "all waves finished with no acceptance" });
    actions.push("exhausted");
  }
}

/** Sets first_acceptance_at exactly once and moves searching → options_ready. */
export async function markFirstAcceptance(r: Referral, attempt: Attempt): Promise<boolean> {
  const at = attempt.outcome_at ? new Date(attempt.outcome_at) : now();
  const updated = await one<Referral>(
    `update referrals set first_acceptance_at = $2, updated_at = $3,
       status = case when status in ('searching','exhausted') then 'options_ready' else status end
     where id = $1 and first_acceptance_at is null and status not in ('cancelled','closed') returning *`,
    [r.id, at, now()],
  );
  if (!updated) return false;
  await addEventOnce(r.id, "options_ready", {
    facility_id: attempt.facility_id,
    ttfa_seconds: Math.floor((at.getTime() - new Date(r.created_at).getTime()) / 1000),
  }, attempt.id);
  return true;
}

// ============================================================ select, hold, handoff

const SELECTABLE = ["options_ready", "searching", "exhausted"];
/** Longest a hold call waits for the accepting call to end before dialling anyway. */
const HOLD_WAIT_MAX_S = 90;

function parentStillOnLine(a: Attempt): boolean {
  return !isTerminal(a.status) && a.status !== "wrapping_up";
}

/** Dispatches a queued hold call exactly once (claimed by marking it, so concurrent evaluations can't both dial). */
async function dispatchHoldCall(ctx: ReferralCtx, hold: Attempt): Promise<boolean> {
  const claimed = await updateAttempt(hold.id, { bolna_status: "dispatching" }, { bolna_status: null, status: "queued" });
  if (!claimed) return false;
  const ok = await dispatchCall(ctx, claimed);
  if (!ok) {
    await updateReferral(ctx.referral.id, { status: "options_ready", selected_attempt_id: null, selected_facility_id: null }, ["confirming"]);
    await addEvent(ctx.referral.id, "alert", {
      kind: "hold_call_failed",
      facility_id: hold.facility_id,
      message: "Couldn't place the confirmation call. Call the desk, then use “I already confirmed by phone”.",
    });
  }
  return ok;
}

export async function selectAttempt(referralId: string, attemptId: string, force = false) {
  const r = await getReferral(referralId);
  if (!r) throw new AppError(404, "NOT_FOUND", "Referral not found");
  if (!SELECTABLE.includes(r.status)) throw new AppError(409, "NOT_SELECTABLE", `Referral is ${r.status}`);
  const a = await getAttempt(attemptId);
  if (!a || a.referral_id !== r.id || a.purpose !== "availability" || !isAcceptance(a)) {
    throw new AppError(409, "ATTEMPT_NOT_ACCEPTED", "That hospital has not accepted");
  }
  if (a.needs_review && !force) {
    throw new AppError(409, "NEEDS_REVIEW", "The answer is unclear: listen to the recording before selecting");
  }
  const updated = await updateReferral(
    r.id,
    { status: "confirming", selected_attempt_id: a.id, selected_facility_id: a.facility_id },
    SELECTABLE,
  );
  if (!updated) throw new AppError(409, "NOT_SELECTABLE", "The referral changed; try again");
  await addEvent(r.id, "facility_selected", { facility_id: a.facility_id }, a.id);

  const hold = await insertAttempt({
    referral_id: r.id,
    facility_id: a.facility_id,
    contact_id: a.contact_id,
    parent_attempt_id: a.id,
    purpose: "hold_confirm",
    wave: a.wave,
    rank: a.rank,
    distance_km: a.distance_km,
    eta_minutes: a.eta_minutes,
    to_number: a.to_number,
    call_language: a.call_language,
  });
  if (hold && parentStillOnLine(a)) {
    await addEvent(r.id, "hold_call_waiting", { facility_id: a.facility_id }, hold.id);
    return { status: "confirming" as const, hold_attempt_id: hold.id };
  }
  const ok = hold ? await dispatchHoldCall(await loadCtx(updated), hold) : false;
  if (!ok) return { status: "options_ready" as const, hold_attempt_id: hold?.id ?? null };
  return { status: "confirming" as const, hold_attempt_id: hold!.id };
}

function holdUntil(etaMinutes: number | null): Date {
  return addMinutes(now(), (etaMinutes ?? 0) + HOLD_BUFFER_MIN);
}

/** Hold-confirm answer (function, extraction or simulation). Returns follow-up work to run after responding. */
export async function applyHoldResult(
  hold: Attempt,
  result: { confirmed: "yes" | "no"; contact_person: string | null; whatsapp_number: string | null; notes: string | null },
  source: "function" | "extraction" | "simulation" | "whatsapp",
): Promise<() => Promise<void>> {
  const outcome = result.confirmed === "yes" ? "hold_confirmed" : "hold_declined";
  const changed = await one<Attempt>(
    `update call_attempts set outcome = $2, outcome_source = $3, contact_person = coalesce($4, contact_person),
       conditions = coalesce($5, conditions), outcome_at = $6, answered_at = coalesce(answered_at, $6), updated_at = $6
     where id = $1 and outcome is distinct from $2 returning *`,
    [hold.id, outcome, source, result.contact_person, result.notes, now()],
  );
  if (!changed) return async () => {};
  const r = await getReferral(hold.referral_id);
  if (!r) return async () => {};

  if (result.confirmed === "yes") {
    const confirmed = await updateReferral(
      r.id,
      { status: "confirmed", confirmed_at: now(), hold_expires_at: holdUntil(hold.eta_minutes) },
      ["confirming"],
    );
    if (result.whatsapp_number && hold.facility_id) {
      const wa = normalizePhone(result.whatsapp_number);
      if (wa) await q(`update facilities set whatsapp_number = $2 where id = $1`, [hold.facility_id, wa]);
    }
    await addEvent(r.id, "hold_confirmed", { facility_id: hold.facility_id, contact_person: result.contact_person }, hold.id);
    if (!confirmed) return async () => { await evaluateReferral(r.id); };
    return async () => {
      await sendHandoff(r.id);
      await evaluateReferral(r.id);
    };
  }

  await updateReferral(r.id, { status: "options_ready", selected_attempt_id: null, selected_facility_id: null }, ["confirming"]);
  if (hold.parent_attempt_id) {
    // The desk withdrew its yes: show it as declined so it can't be selected again.
    await updateAttempt(hold.parent_attempt_id, {
      outcome: "declined",
      decline_reason: `bed no longer available${result.notes ? `: ${result.notes}` : ""}`,
      outcome_at: now(),
    });
  }
  await addEvent(r.id, "hold_declined", { facility_id: hold.facility_id, contact_person: result.contact_person }, hold.id);
  return async () => { await evaluateReferral(r.id); };
}

/** The hold call ended without a clear answer: hand the decision back to the doctor. */
export async function holdUnconfirmed(hold: Attempt): Promise<void> {
  const r = await getReferral(hold.referral_id);
  if (!r || r.status !== "confirming" || r.selected_attempt_id !== hold.parent_attempt_id) return;
  await updateReferral(r.id, { status: "options_ready", selected_attempt_id: null, selected_facility_id: null }, ["confirming"]);
  await addEvent(r.id, "alert", {
    kind: "hold_unconfirmed",
    facility_id: hold.facility_id,
    message: "The bed wasn't confirmed on the call. Call the desk, then use “I already confirmed by phone”, or pick another hospital.",
  }, hold.id);
}

export async function confirmManually(referralId: string, attemptId: string, contactPerson: string | null) {
  const r = await getReferral(referralId);
  if (!r) throw new AppError(404, "NOT_FOUND", "Referral not found");
  if (![...SELECTABLE, "confirming"].includes(r.status)) throw new AppError(409, "NOT_CONFIRMABLE", `Referral is ${r.status}`);
  const a = await getAttempt(attemptId);
  if (!a || a.referral_id !== r.id || a.purpose !== "availability" || !isAcceptance(a)) {
    throw new AppError(409, "ATTEMPT_NOT_ACCEPTED", "That hospital has not accepted");
  }
  if (contactPerson) await updateAttempt(a.id, { contact_person: contactPerson });
  const updated = await updateReferral(
    r.id,
    {
      status: "confirmed",
      selected_attempt_id: a.id,
      selected_facility_id: a.facility_id,
      confirmed_at: now(),
      hold_expires_at: holdUntil(a.eta_minutes),
    },
    [...SELECTABLE, "confirming"],
  );
  if (!updated) throw new AppError(409, "NOT_CONFIRMABLE", "The referral changed; try again");
  await addEvent(r.id, "hold_confirmed", { facility_id: a.facility_id, contact_person: contactPerson, manual: true }, a.id);
  return async () => {
    await sendHandoff(r.id);
    await evaluateReferral(r.id);
  };
}

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
export const formatTime = (d: Date | string) => timeFmt.format(new Date(d));

/** Pre-arrival note, doctor confirmation and family message. Idempotent. */
export async function sendHandoff(referralId: string): Promise<void> {
  const r = await getReferral(referralId);
  if (!r || r.status !== "confirmed" || !r.selected_attempt_id || !r.selected_facility_id) return;
  const already = await one(`select 1 from messages where referral_id = $1 and audience = 'receiving_facility'`, [r.id]);
  if (already) return;
  const ctx = await loadCtx(r);
  const [selected, facility, patient, hold] = await Promise.all([
    getAttempt(r.selected_attempt_id),
    getFacility(r.selected_facility_id),
    one<{ patient_name: string | null; attendant_phone_e164: string | null; attendant_language: string }>(
      `select patient_name, attendant_phone_e164, attendant_language from patient_details where referral_id = $1`, [r.id],
    ),
    one<Attempt>(
      `select * from call_attempts where referral_id = $1 and purpose = 'hold_confirm' and outcome = 'hold_confirmed'
       order by created_at desc limit 1`, [r.id],
    ),
  ]);
  if (!selected || !facility) return;
  const contactPerson = hold?.contact_person || selected.contact_person;
  const facts: HandoffFacts = {
    code: r.code,
    doctor_name: ctx.referrer.name.replace(/\s*\(Demo\)/i, ""),
    doctor_phone: ctx.referrer.phone_e164,
    referring_facility: (ctx.origin?.name ?? "").replace(/\s*\(Demo\)/i, ""),
    patient_name: patient?.patient_name ?? null,
    who: describeWho(r.age_value, r.age_unit, r.sex),
    case_label: ctx.template.label,
    acuity: r.acuity,
    note: r.note,
    needs_labels: ctx.needs.map((n) => n.label),
    eta_minutes: selected.eta_minutes,
    transport: r.transport,
    contact_person: contactPerson,
    confirmed_time: formatTime(r.confirmed_at ?? now()),
    hospital_name: facility.name.replace(/\s*\(Demo\)/i, ""),
    hospital_address: [facility.address, facility.city].filter((x) => x && x !== "Demo address").join(", ") || null,
    hospital_lat: facility.lat,
    hospital_lng: facility.lng,
    desk_number: selected.to_number,
    bed_type: selected.bed_type,
    conditions: selected.conditions,
    hold_until_time: formatTime(r.hold_expires_at ?? now()),
    aapat_setu_url: env.aapatSetuUrl ? env.aapatSetuUrl.replace("{code}", encodeURIComponent(r.code)) : null,
  };
  const simulated = r.is_simulated;
  await sendWhatsApp({ referral_id: r.id, audience: "receiving_facility", to: facility.whatsapp_number, rendered: preArrivalNote(facts), simulated });
  await q(`update patient_details set shared_with_facility_at = $2 where referral_id = $1`, [r.id, now()]);
  await sendWhatsApp({ referral_id: r.id, audience: "referrer", to: ctx.referrer.phone_e164, rendered: doctorConfirmation(facts), simulated });
  if (patient?.attendant_phone_e164) {
    await sendWhatsApp({
      referral_id: r.id,
      audience: "family",
      to: patient.attendant_phone_e164,
      rendered: familyMessage(facts, patient.attendant_language),
      simulated,
    });
    if (env.familyCalls) await dispatchFamilyCall(r, "handoff");
  }
}

/**
 * C1: a voice call to the attendant in their language after the bed is confirmed (and again on a missed call, C3).
 * Live calls need BOLNA_AGENT_ID_FAMILY; simulated referrals always place one. At most one every 10 minutes.
 */
export async function dispatchFamilyCall(r: Referral, reason: "handoff" | "missed_call"): Promise<Attempt | null> {
  if (!r.is_simulated && !env.agentId("family_update")) return null;
  if (!r.selected_attempt_id) return null;
  const patient = await one<{ attendant_phone_e164: string | null; attendant_language: string }>(
    `select attendant_phone_e164, attendant_language from patient_details where referral_id = $1`, [r.id],
  );
  if (!patient?.attendant_phone_e164) return null;
  const recent = await one(
    `select 1 from call_attempts where referral_id = $1 and purpose = 'family_update' and created_at > $2`,
    [r.id, new Date(now().getTime() - 10 * 60_000)],
  );
  if (recent) return null;
  const selected = await getAttempt(r.selected_attempt_id);
  const a = await insertAttempt({
    referral_id: r.id,
    facility_id: r.selected_facility_id,
    purpose: "family_update",
    eta_minutes: selected?.eta_minutes ?? null,
    to_number: maskPhone(patient.attendant_phone_e164),
    call_language: patient.attendant_language,
  });
  if (!a) return null;
  await addEvent(r.id, "family_call_dispatched", { reason }, a.id);
  await dispatchCall(await loadCtx(r), a);
  return a;
}

// ============================================================ cancel, close, manual actions

export async function cancelReferral(referralId: string, reason: string | null) {
  const r = await getReferral(referralId);
  if (!r) throw new AppError(404, "NOT_FOUND", "Referral not found");
  const updated = await updateReferral(
    r.id,
    { status: "cancelled", close_reason: reason || "cancelled" },
    ["searching", "options_ready", "confirming", "confirmed", "exhausted"],
  );
  if (!updated) throw new AppError(409, "NOT_CANCELLABLE", `Referral is ${r.status}`);
  // Only queued calls can be stopped; ringing and live calls finish naturally.
  for (const a of (await getAttempts(r.id)).filter((x) => x.status === "queued")) {
    try {
      if (a.bolna_execution_id) await stopCall(a.bolna_execution_id);
      await casAttemptStatus(a, "canceled", { ended_at: now() });
    } catch {
      // The call already started; let it finish.
    }
  }
  await addEvent(r.id, "referral_cancelled", { reason: reason || "cancelled" });
  return async () => { await evaluateReferral(r.id); };
}

export async function closeReferral(referralId: string, reason: string, note: string | null) {
  const r = await getReferral(referralId);
  if (!r) throw new AppError(404, "NOT_FOUND", "Referral not found");
  const safeNote = note && !checkNote(note).blocked ? note.slice(0, 160) : null;
  const updated = await updateReferral(
    r.id,
    { status: "closed", closed_at: now(), close_reason: safeNote ? `${reason}: ${safeNote}` : reason },
    ["searching", "options_ready", "confirming", "confirmed", "exhausted", "cancelled"],
  );
  if (!updated) throw new AppError(409, "NOT_CLOSABLE", `Referral is ${r.status}`);
  await addEvent(r.id, "referral_closed", { reason });
}

/** When the doctor records "call back later" from their own call, Haazir calls back after this long. */
const MANUAL_CALLBACK_MIN = 5;

export interface ManualOutcome {
  outcome: Attempt["outcome"] & string;
  bed_type?: string | null;
  ready_in_minutes?: number | null;
  contact_person?: string | null;
  conditions?: string | null;
  decline_reason?: string | null;
}

export async function recordManualOutcome(attemptId: string, m: ManualOutcome) {
  const a = await getAttempt(attemptId);
  if (!a) throw new AppError(404, "NOT_FOUND", "Attempt not found");
  if (a.purpose !== "availability") throw new AppError(409, "WRONG_PURPOSE", "Manual outcomes are for availability calls");
  const updated = await updateAttempt(a.id, {
    outcome: m.outcome,
    outcome_source: "manual",
    needs_review: false,
    bed_type: m.bed_type || null,
    ready_in_minutes: m.ready_in_minutes ?? null,
    contact_person: m.contact_person || null,
    conditions: m.conditions || null,
    decline_reason: m.decline_reason || null,
    callback_due_at: m.outcome === "callback_later" ? addMinutes(now(), MANUAL_CALLBACK_MIN) : null,
    outcome_at: now(),
  });
  await addEvent(a.referral_id, "outcome_recorded", {
    facility_id: a.facility_id, outcome: m.outcome, bed_type: m.bed_type || null, ready_in_minutes: m.ready_in_minutes ?? null, source: "manual",
  }, a.id);
  const r = await getReferral(a.referral_id);
  if (r && updated && isAcceptance(updated)) await markFirstAcceptance(r, updated);
  if (updated) await checkPortalMismatch(updated);
  await evaluateReferral(a.referral_id);
  return updated;
}

export async function redialManually(attemptId: string, target: { contact_id?: string; to_number?: string }) {
  const a = await getAttempt(attemptId);
  if (!a || a.purpose !== "availability") throw new AppError(404, "NOT_FOUND", "Attempt not found");
  const r = await getReferral(a.referral_id);
  if (!r || !ACTIVE_REFERRAL.includes(r.status)) throw new AppError(409, "NOT_ACTIVE", "Referral is not searching");
  const siblings = (await getAttempts(r.id)).filter((x) => x.purpose === "availability" && x.facility_id === a.facility_id);
  if (siblings.filter((x) => x.parent_attempt_id).length >= MAX_REDIALS_PER_FACILITY) {
    throw new AppError(429, "REDIAL_LIMIT", "Already redialed this hospital twice for this referral");
  }
  let to: { to_number: string; contact_id: string | null };
  if (target.contact_id) {
    const c = await getContact(target.contact_id);
    if (!c || c.facility_id !== a.facility_id) throw new AppError(422, "BAD_CONTACT", "Contact not found for this hospital");
    to = { to_number: c.phone_e164, contact_id: c.id };
  } else {
    const phone = normalizePhone(target.to_number);
    if (!phone) throw new AppError(422, "BAD_NUMBER", "Not a valid phone number");
    to = { to_number: phone, contact_id: await addContact(a.facility_id, phone, "other") };
  }
  const child = await redial(await loadCtx(r), a, to, "manual");
  if (!child) throw new AppError(409, "ALREADY_REDIALED", "This call was already redialed; redial the latest attempt");
  return child;
}

/** Adds an unverified contact (e.g. from a redirect). Returns its id. */
export async function addContact(facilityId: string | null, phone: string, role: string): Promise<string | null> {
  if (!facilityId) return null;
  const row = await one<{ id: string }>(
    `insert into facility_contacts (facility_id, role, phone_e164, priority, is_ivr, created_at)
     values ($1, $2, $3, 9, false, $4)
     on conflict (facility_id, phone_e164) do update set active = true
     returning id`,
    [facilityId, role, phone, now()],
  );
  return row?.id ?? null;
}

export { redial };

/** "Widen to 80 km and try again": a new referral with the same case (and patient details), the old one closed. */
export async function widenReferral(referralId: string, radiusKm: number) {
  const r = await getReferral(referralId);
  if (!r) throw new AppError(404, "NOT_FOUND", "Referral not found");
  // Only once every call has finished, so no live call is left answering for a closed referral.
  if (r.status !== "exhausted") throw new AppError(409, "NOT_WIDENABLE", "Widen the search once every hospital has answered");
  const patient = await one<{ patient_name: string | null; attendant_name: string | null; attendant_phone_e164: string | null; attendant_language: string }>(
    `select patient_name, attendant_name, attendant_phone_e164, attendant_language from patient_details where referral_id = $1`, [r.id],
  );
  const created = await createReferral(
    {
      referrer_id: r.referrer_id,
      case_type: r.case_type,
      required_capabilities: r.required_capabilities,
      acuity: r.acuity,
      age_value: r.age_value,
      age_unit: r.age_unit,
      sex: r.sex,
      note: r.note,
      transport: r.transport as ReferralInput["transport"],
      search_radius_km: Math.max(radiusKm, r.search_radius_km + 1),
      origin_lat: r.origin_lat,
      origin_lng: r.origin_lng,
      patient: patient
        ? { patient_name: patient.patient_name, attendant_name: patient.attendant_name, attendant_phone: patient.attendant_phone_e164, attendant_language: patient.attendant_language }
        : undefined,
    },
    { simulate: r.is_simulated },
  );
  await updateReferral(r.id, { status: "closed", closed_at: now(), close_reason: `widened to ${radiusKm} km: ${created.referral.code}` });
  await addEvent(r.id, "referral_closed", { reason: "widened", next_referral_id: created.referral.id });
  return created.referral;
}

/**
 * A desk said yes after the patient was placed (or the referral was cancelled). The agent tells them on the same call,
 * so record that as their release instead of phoning them again a minute later.
 */
export async function recordInCallRelease(acceptor: Attempt): Promise<void> {
  const rel = await insertAttempt({
    referral_id: acceptor.referral_id,
    facility_id: acceptor.facility_id,
    contact_id: acceptor.contact_id,
    parent_attempt_id: acceptor.id,
    purpose: "release",
    wave: acceptor.wave,
    rank: acceptor.rank,
    to_number: acceptor.to_number,
    call_language: acceptor.call_language,
  });
  if (!rel) return; // already released
  const t = now();
  await updateAttempt(rel.id, { status: "completed", bolna_status: "in_call", outcome: "release_ack", outcome_source: "function", outcome_at: t, ended_at: t });
  await addEvent(acceptor.referral_id, "release_dispatched", { facility_id: acceptor.facility_id, in_call: true }, rel.id);
}
