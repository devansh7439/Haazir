import "server-only";
import { ACTIVE_LIVE_WINDOW_H, DEFAULT_RADIUS_KM, WAVE_SIZE, env } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { normalizePhone } from "@/lib/core/normalize";
import type { Attempt, Referral } from "@/lib/core/types";
import { stopCall } from "@/lib/integrations/bolna/bolna.client";
import { buildSpokenSummary, checkNote } from "@/lib/modules/referral/summary.helper";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { type FollowUp } from "@/lib/modules/call/call.type";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { FacilityService } from "@/lib/modules/facility/facility.service";
import type { MatchParams } from "@/lib/modules/facility/facility.type";
import { applyEtaCap } from "@/lib/modules/facility/matching.helper";
import { CANCELLABLE, CLOSABLE } from "@/lib/modules/referral/referral.helper";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import type { PreparedReferral, ReferralInput } from "@/lib/modules/referral/referral.type";

type Created = { referral: Referral; attempts: Attempt[]; duplicate?: true };

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
