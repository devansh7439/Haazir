import "server-only";
import { ACTIVE_LIVE_WINDOW_H, DEFAULT_RADIUS_KM, WAVE_SIZE, env } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { normalizePhone } from "@/lib/core/normalize";
import type { Attempt, Referral } from "@/lib/core/types";
import { stopCall } from "@/lib/integrations/bolna/bolna.client";
import { doctorConfirmation, familyMessage, preArrivalNote } from "@/lib/modules/handoff/message.helper";
import { buildSpokenSummary, checkNote } from "@/lib/modules/referral/summary.helper";
import { WhatsAppService } from "@/lib/modules/handoff/whatsapp.service";
import { isAcceptance, stillOnLine } from "@/lib/modules/call/call.helper";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { noFollowUp, type FollowUp, type OutcomeSource } from "@/lib/modules/call/call.type";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { FacilityService } from "@/lib/modules/facility/facility.service";
import type { MatchParams } from "@/lib/modules/facility/facility.type";
import { applyEtaCap } from "@/lib/modules/facility/matching.helper";
import { CANCELLABLE, CLOSABLE, CONFIRMABLE, SELECTABLE, handoffFacts, holdUntil } from "@/lib/modules/referral/referral.helper";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import type { PreparedReferral, ReferralInput } from "@/lib/modules/referral/referral.type";

type Created = { referral: Referral; attempts: Attempt[]; duplicate?: true };

/** A hold call's result, from the function, the call's extraction, the simulator or a WhatsApp reply. */
export interface HoldResult {
  confirmed: "yes" | "no";
  contact_person: string | null;
  whatsapp_number: string | null;
  notes: string | null;
}

/** Checks a referral and ranks the hospitals, writing nothing. Throws a 422 for anything the form must fix. */
const prepare = async (input: ReferralInput, orgId?: string): Promise<PreparedReferral> => {
  const referrer = await ReferralRepository.referrer(input.referrer_id);
  // A referrer from another organisation is reported exactly like a missing one.
  if (!referrer || (orgId && referrer.org_id !== orgId)) throw ApiError.unprocessable("UNKNOWN_REFERRER", "Referrer not found");
  const origin = referrer.facility_id ? await FacilityRepository.get(referrer.facility_id) : null;
  const lat = origin?.lat ?? input.origin_lat;
  const lng = origin?.lng ?? input.origin_lng;
  if (lat === undefined || lng === undefined) throw ApiError.unprocessable("ORIGIN_REQUIRED", "Origin location is required");
  const template = await ReferralRepository.caseTemplate(input.case_type);
  if (!template) throw ApiError.unprocessable("UNKNOWN_CASE_TYPE", "Unknown case type");
  const codes = [...new Set(input.required_capabilities)];
  const needs = await FacilityRepository.capabilities(codes);
  if (needs.length !== codes.length) {
    const known = new Set(needs.map((n) => n.code));
    throw ApiError.unprocessable("UNKNOWN_CAPABILITY", "Unknown capability", { unknown: codes.filter((c) => !known.has(c)) });
  }
  if (needs.length === 0 && input.case_type !== "other") throw ApiError.unprocessable("NEEDS_REQUIRED", "Choose at least one need");
  const noteCheck = checkNote(input.note);
  if (noteCheck.blocked) throw ApiError.unprocessable("NOTE_CONTAINS_IDENTIFIER", noteCheck.errors[0], { errors: noteCheck.errors });

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
    lat,
    lng,
    radius_km: input.search_radius_km ?? DEFAULT_RADIUS_KM,
    needs: codes,
    origin_id: origin?.id ?? null,
    org_id: referrer.org_id,
  };
  const ranked = await FacilityService.rankEligible(params, needs.map((n) => n.label));
  const { kept, skipped } = applyEtaCap(ranked, env.maxEtaMinutes(input.acuity));
  return { referrer, origin, template, needs, params, spoken_summary, warnings: noteCheck.warnings, ranked: kept, skipped_far: skipped };
};

/** The referral an earlier press of the same "Find a bed" created, with its calls; null when this is the first. */
const findRepeat = async (orgId: string, requestId: string | undefined): Promise<Created | null> => {
  if (!requestId) return null;
  const existing = await ReferralRepository.findByRequestId(orgId, requestId);
  return existing ? { referral: existing, attempts: await CallRepository.listForReferral(existing.id), duplicate: true } : null;
};

/** A referral from creation to close (docs/02-architecture.md §6). */
export const ReferralService = {
  /** What would happen if the form were submitted now: the spoken summary, warnings and the hospitals that would be called. */
  preview: async (input: ReferralInput, opts: { orgId?: string } = {}) => {
    const p = await prepare(input, opts.orgId);
    return {
      spoken_summary: p.spoken_summary,
      warnings: p.warnings,
      wave_size: WAVE_SIZE,
      skipped_far: p.skipped_far,
      max_eta_minutes: env.maxEtaMinutes(input.acuity) || null,
      suggestions: p.ranked.length === 0 ? await FacilityService.suggestionsFor(p.params, p.needs) : [],
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
  },

  /**
   * Creates the referral and calls the first wave. Idempotent on `client_request_id`: a repeat returns the first
   * referral with `duplicate`. Live referrals need Bolna configured and stay under the organisation's live cap.
   */
  create: async (input: ReferralInput, opts: { simulate?: boolean; orgId?: string } = {}): Promise<Created> => {
    const p = await prepare(input, opts.orgId);
    const orgId = p.referrer.org_id;
    const repeat = await findRepeat(orgId, input.client_request_id);
    if (repeat) return repeat;
    if (p.ranked.length === 0) {
      const suggestions = await FacilityService.suggestionsFor(p.params, p.needs);
      throw ApiError.conflict("NO_ELIGIBLE_FACILITIES", "No eligible hospital in range", { suggestions });
    }
    const simulated = !!opts.simulate || env.simulationMode;
    if (!simulated && (!env.bolnaApiKey || !env.agentId("availability"))) {
      throw ApiError.unprocessable(
        "BOLNA_NOT_CONFIGURED",
        "Live calls need BOLNA_API_KEY and BOLNA_AGENT_ID_AVAILABILITY. Run it as a simulation instead.",
      );
    }
    if (!simulated) {
      const active = await ReferralRepository.countActiveLive(orgId, addMinutes(now(), -ACTIVE_LIVE_WINDOW_H * 60));
      if (active >= env.maxActiveLiveReferrals) {
        throw ApiError.tooMany(
          "TOO_MANY_ACTIVE_REFERRALS",
          `${active} referrals are already calling hospitals. Finish or cancel one first.`,
        );
      }
    }
    const pt = input.patient;
    const attendantPhone = pt?.attendant_phone ? normalizePhone(pt.attendant_phone) : null;
    if (pt?.attendant_phone && !attendantPhone) {
      throw ApiError.unprocessable(
        "INVALID_ATTENDANT_PHONE",
        "The attendant's phone number doesn't look right. Use a 10-digit mobile number.",
      );
    }

    const t = now();
    const referral = await ReferralRepository.insert(
      {
        referrer_id: p.referrer.id,
        origin_facility_id: p.origin?.id ?? null,
        origin_lat: p.params.lat,
        origin_lng: p.params.lng,
        case_type: input.case_type,
        acuity: input.acuity,
        age_value: input.age_value ?? null,
        age_unit: input.age_unit ?? "years",
        sex: input.sex ?? "unknown",
        note: input.note?.trim() || null,
        required_capabilities: p.params.needs,
        spoken_summary: p.spoken_summary,
        transport: input.transport ?? "ambulance",
        search_radius_km: p.params.radius_km,
        is_simulated: simulated,
        is_demo: p.origin?.is_demo ?? false,
        client_request_id: input.client_request_id ?? null,
      },
      t,
    );
    if (!referral) {
      // Lost a race with the same request (a double-click): hand back the referral the other request created.
      const raced = await findRepeat(orgId, input.client_request_id);
      if (raced) return raced;
      throw ApiError.internal("INSERT_FAILED", "Could not create the referral");
    }

    if (pt && (pt.patient_name || pt.attendant_name || pt.attendant_phone)) {
      const patient = {
        patient_name: pt.patient_name || null,
        attendant_name: pt.attendant_name || null,
        attendant_phone_e164: attendantPhone,
        attendant_language: pt.attendant_language || "en",
      };
      await ReferralRepository.insertPatient(referral.id, patient, t);
    }
    await EventRepository.add(referral.id, "referral_created", {
      case_type: referral.case_type,
      acuity: referral.acuity,
      required_capabilities: referral.required_capabilities,
      simulated,
    });

    const claimed = await ReferralRepository.claimWave(referral.id, 0);
    const ctx = await ReferralRepository.context(claimed ?? referral);
    const attempts = claimed ? await CallService.dispatchWave(ctx, 1, p.ranked) : [];
    return { referral: claimed ?? referral, attempts };
  },

  /**
   * The doctor chooses a hospital that said yes. A hold call confirms the bed: at once, or as soon as the accepting
   * call ends. An answer under review needs `force` (the doctor listened to the recording).
   */
  select: async (referralId: string, attemptId: string, force = false) => {
    const r = await ReferralRepository.get(referralId);
    if (!r) throw ApiError.notFound("Referral not found");
    if (!SELECTABLE.includes(r.status)) throw ApiError.conflict("NOT_SELECTABLE", `Referral is ${r.status}`);
    const a = await CallRepository.get(attemptId);
    if (!a || a.referral_id !== r.id || a.purpose !== "availability" || !isAcceptance(a)) {
      throw ApiError.conflict("ATTEMPT_NOT_ACCEPTED", "That hospital has not accepted");
    }
    if (a.needs_review && !force) {
      throw ApiError.conflict("NEEDS_REVIEW", "The answer is unclear: listen to the recording before selecting");
    }
    const selection = { status: "confirming" as const, selected_attempt_id: a.id, selected_facility_id: a.facility_id };
    const updated = await ReferralRepository.update(r.id, selection, SELECTABLE);
    if (!updated) throw ApiError.conflict("NOT_SELECTABLE", "The referral changed; try again");
    await EventRepository.add(r.id, "facility_selected", { facility_id: a.facility_id }, a.id);

    const hold = await CallRepository.insert({
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
    if (hold && stillOnLine(a)) {
      await EventRepository.add(r.id, "hold_call_waiting", { facility_id: a.facility_id }, hold.id);
      return { status: "confirming" as const, hold_attempt_id: hold.id };
    }
    const ok = hold ? await CallService.dispatchHold(await ReferralRepository.context(updated), hold) : false;
    if (!ok) return { status: "options_ready" as const, hold_attempt_id: hold?.id ?? null };
    return { status: "confirming" as const, hold_attempt_id: hold!.id };
  },

  /** Applies a hold call's answer. Returns the follow-up to run after responding (handoff and evaluation). */
  applyHoldResult: async (hold: Attempt, result: HoldResult, source: OutcomeSource): Promise<FollowUp> => {
    const outcome = result.confirmed === "yes" ? "hold_confirmed" : "hold_declined";
    const changed = await CallRepository.recordHoldOutcome(hold.id, outcome, source, result.contact_person, result.notes);
    if (!changed) return noFollowUp;
    const r = await ReferralRepository.get(hold.referral_id);
    if (!r) return noFollowUp;
    const evaluate: FollowUp = async () => {
      await EvaluationService.evaluate(r.id);
    };

    if (result.confirmed === "yes") {
      const fields = { status: "confirmed" as const, confirmed_at: now(), hold_expires_at: holdUntil(now(), hold.eta_minutes) };
      const confirmed = await ReferralRepository.update(r.id, fields, ["confirming"]);
      const whatsapp = result.whatsapp_number && hold.facility_id ? normalizePhone(result.whatsapp_number) : null;
      if (whatsapp && hold.facility_id) await FacilityRepository.setWhatsappNumber(hold.facility_id, whatsapp);
      await EventRepository.add(r.id, "hold_confirmed", { facility_id: hold.facility_id, contact_person: result.contact_person }, hold.id);
      if (!confirmed) return evaluate;
      return async () => {
        await ReferralService.sendHandoff(r.id);
        await EvaluationService.evaluate(r.id);
      };
    }

    await ReferralRepository.reopenChoice(r.id);
    if (hold.parent_attempt_id) {
      // The desk withdrew its yes: show it as declined so it can't be selected again.
      await CallRepository.update(hold.parent_attempt_id, {
        outcome: "declined",
        decline_reason: `bed no longer available${result.notes ? `: ${result.notes}` : ""}`,
        outcome_at: now(),
      });
    }
    await EventRepository.add(r.id, "hold_declined", { facility_id: hold.facility_id, contact_person: result.contact_person }, hold.id);
    return evaluate;
  },

  /** The hold call ended without a clear answer: the decision goes back to the doctor. */
  holdUnconfirmed: async (hold: Attempt): Promise<void> => {
    const r = await ReferralRepository.get(hold.referral_id);
    if (!r || r.status !== "confirming" || r.selected_attempt_id !== hold.parent_attempt_id) return;
    await ReferralRepository.reopenChoice(r.id);
    await EventRepository.add(r.id, "alert", {
      kind: "hold_unconfirmed",
      facility_id: hold.facility_id,
      message: "The bed wasn't confirmed on the call. Call the desk, then use “I already confirmed by phone”, or pick another hospital.",
    }, hold.id);
  },

  /** The doctor confirmed the bed by phone themselves. Returns the follow-up (handoff and evaluation). */
  confirmManually: async (referralId: string, attemptId: string, contactPerson: string | null): Promise<FollowUp> => {
    const r = await ReferralRepository.get(referralId);
    if (!r) throw ApiError.notFound("Referral not found");
    if (!CONFIRMABLE.includes(r.status)) throw ApiError.conflict("NOT_CONFIRMABLE", `Referral is ${r.status}`);
    const a = await CallRepository.get(attemptId);
    if (!a || a.referral_id !== r.id || a.purpose !== "availability" || !isAcceptance(a)) {
      throw ApiError.conflict("ATTEMPT_NOT_ACCEPTED", "That hospital has not accepted");
    }
    if (contactPerson) await CallRepository.update(a.id, { contact_person: contactPerson });
    const fields = {
      status: "confirmed" as const,
      selected_attempt_id: a.id,
      selected_facility_id: a.facility_id,
      confirmed_at: now(),
      hold_expires_at: holdUntil(now(), a.eta_minutes),
    };
    if (!(await ReferralRepository.update(r.id, fields, CONFIRMABLE))) {
      throw ApiError.conflict("NOT_CONFIRMABLE", "The referral changed; try again");
    }
    await EventRepository.add(r.id, "hold_confirmed", { facility_id: a.facility_id, contact_person: contactPerson, manual: true }, a.id);
    return async () => {
      await ReferralService.sendHandoff(r.id);
      await EvaluationService.evaluate(r.id);
    };
  },

  /** Pre-arrival note to the hospital, confirmation to the doctor, message (and call) to the family. Idempotent. */
  sendHandoff: async (referralId: string): Promise<void> => {
    const r = await ReferralRepository.get(referralId);
    if (!r || r.status !== "confirmed" || !r.selected_attempt_id || !r.selected_facility_id) return;
    if (await ReferralRepository.hasHandoff(r.id)) return;
    const ctx = await ReferralRepository.context(r);
    const [selected, facility, patient, hold] = await Promise.all([
      CallRepository.get(r.selected_attempt_id),
      FacilityRepository.get(r.selected_facility_id),
      ReferralRepository.patient(r.id),
      CallRepository.latestConfirmedHold(r.id),
    ]);
    if (!selected || !facility) return;
    const contactPerson = hold?.contact_person || selected.contact_person;
    const facts = handoffFacts({ ctx, selected, facility, patient, contactPerson, now: now() });
    const simulated = r.is_simulated;
    const prearrival = preArrivalNote(facts);
    await WhatsAppService.send({
      referral_id: r.id,
      audience: "receiving_facility",
      to: facility.whatsapp_number,
      rendered: prearrival,
      simulated,
    });
    await ReferralRepository.markSharedWithFacility(r.id);
    await WhatsAppService.send({
      referral_id: r.id,
      audience: "referrer",
      to: ctx.referrer.phone_e164,
      rendered: doctorConfirmation(facts),
      simulated,
    });
    if (patient?.attendant_phone_e164) {
      const rendered = familyMessage(facts, patient.attendant_language);
      await WhatsAppService.send({ referral_id: r.id, audience: "family", to: patient.attendant_phone_e164, rendered, simulated });
      if (env.familyCalls) await CallService.dispatchFamilyCall(r, "handoff");
    }
  },

  /** Stops the search. Queued calls are stopped; calls already ringing finish. Returns the follow-up (releases). */
  cancel: async (referralId: string, reason: string | null): Promise<FollowUp> => {
    const r = await ReferralRepository.get(referralId);
    if (!r) throw ApiError.notFound("Referral not found");
    if (!(await ReferralRepository.update(r.id, { status: "cancelled", close_reason: reason || "cancelled" }, CANCELLABLE))) {
      throw ApiError.conflict("NOT_CANCELLABLE", `Referral is ${r.status}`);
    }
    for (const a of (await CallRepository.listForReferral(r.id)).filter((x) => x.status === "queued")) {
      try {
        if (a.bolna_execution_id) await stopCall(a.bolna_execution_id);
        await CallRepository.casStatus(a, "canceled", { ended_at: now() });
      } catch {
        // The call already started; let it finish.
      }
    }
    await EventRepository.add(r.id, "referral_cancelled", { reason: reason || "cancelled" });
    return async () => {
      await EvaluationService.evaluate(r.id);
    };
  },

  /** Closes the referral with a reason. A note is kept only when it holds no identifier, cut to 160 characters. */
  close: async (referralId: string, reason: string, note: string | null): Promise<void> => {
    const r = await ReferralRepository.get(referralId);
    if (!r) throw ApiError.notFound("Referral not found");
    const safeNote = note && !checkNote(note).blocked ? note.slice(0, 160) : null;
    const fields = { status: "closed" as const, closed_at: now(), close_reason: safeNote ? `${reason}: ${safeNote}` : reason };
    if (!(await ReferralRepository.update(r.id, fields, CLOSABLE))) throw ApiError.conflict("NOT_CLOSABLE", `Referral is ${r.status}`);
    await EventRepository.add(r.id, "referral_closed", { reason });
  },

  /** "Widen and try again": a new referral with the same case and patient details over a wider radius; this one closes. */
  widen: async (referralId: string, radiusKm: number): Promise<Referral> => {
    const r = await ReferralRepository.get(referralId);
    if (!r) throw ApiError.notFound("Referral not found");
    // Only once every call has finished, so no live call is left answering for a closed referral.
    if (r.status !== "exhausted") throw ApiError.conflict("NOT_WIDENABLE", "Widen the search once every hospital has answered");
    const patient = await ReferralRepository.patient(r.id);
    const created = await ReferralService.create(
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
          ? {
              patient_name: patient.patient_name,
              attendant_name: patient.attendant_name,
              attendant_phone: patient.attendant_phone_e164,
              attendant_language: patient.attendant_language,
            }
          : undefined,
      },
      { simulate: r.is_simulated },
    );
    const closeReason = `widened to ${radiusKm} km: ${created.referral.code}`;
    await ReferralRepository.update(r.id, { status: "closed", closed_at: now(), close_reason: closeReason });
    await EventRepository.add(r.id, "referral_closed", { reason: "widened", next_referral_id: created.referral.id });
    return created.referral;
  },
};
