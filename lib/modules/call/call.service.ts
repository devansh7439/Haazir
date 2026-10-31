import "server-only";
import { FAMILY_CALL_GAP_MIN, MANUAL_CALLBACK_MIN, MAX_REDIALS_PER_FACILITY, WAVE_SIZE, env } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { maskPhone, normalizePhone, redactNumbers } from "@/lib/core/normalize";
import type { Attempt, Referral } from "@/lib/core/types";
import { BolnaError, makeCall } from "@/lib/bolna";
import { bedRequestMessage } from "@/lib/messages";
import { checkPortalMismatch } from "@/lib/portal";
import { joinSpoken } from "@/lib/summary";
import { sendWhatsApp } from "@/lib/whatsapp";
import { facilityArea, isAcceptance, withoutDemoTag } from "@/lib/modules/call/call.helper";
import { CallRepository } from "@/lib/modules/call/call.repository";
import type { DialTarget } from "@/lib/modules/call/call.type";
import { availabilityUserData, familyUserData, holdConfirmUserData, releaseUserData, type CallContext } from "@/lib/modules/call/user-data.helper";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { FacilityService } from "@/lib/modules/facility/facility.service";
import { applyEtaCap, type RankedFacility } from "@/lib/modules/facility/matching.helper";
import { ACTIVE, shortSummaryOf } from "@/lib/modules/referral/referral.helper";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import type { ManualOutcome, ReferralCtx } from "@/lib/modules/referral/referral.type";

/** A copy of `parent` for a new call to the same hospital: same wave, rank and distance. */
const followOnOf = (parent: Attempt) => ({
  referral_id: parent.referral_id,
  facility_id: parent.facility_id,
  wave: parent.wave,
  rank: parent.rank,
  distance_km: parent.distance_km,
  eta_minutes: parent.eta_minutes,
  call_language: parent.call_language,
});

/** Placing Bolna calls for a referral (docs/02-architecture.md §6), and the doctor's own actions on a call. */
export const CallService = {
  /**
   * Opens a wave: up to WAVE_SIZE hospitals not yet called, best first. Call only after winning the wave claim
   * (CLAUDE.md rule 5). One failed dispatch never blocks the rest. Returns the calls queued.
   */
  dispatchWave: async (ctx: ReferralCtx, wave: number, ranked?: RankedFacility[]): Promise<Attempt[]> => {
    const r = ctx.referral;
    const existing = await CallRepository.listForReferral(r.id);
    const called = new Set(existing.filter((a) => a.purpose === "availability").map((a) => a.facility_id));
    const params = {
      lat: r.origin_lat,
      lng: r.origin_lng,
      radius_km: r.search_radius_km,
      needs: r.required_capabilities,
      origin_id: r.origin_facility_id,
      org_id: r.org_id,
    };
    const pool = ranked ?? applyEtaCap(await FacilityService.rankEligible(params, ctx.needs.map((n) => n.label)), env.maxEtaMinutes(r.acuity)).kept;
    const pick = pool.filter((f) => !called.has(f.facility_id) && f.contact).slice(0, WAVE_SIZE);
    if (pick.length === 0) return [];

    const inserted: Attempt[] = [];
    for (const [i, f] of pick.entries()) {
      const a = await CallRepository.insert({
        referral_id: r.id,
        facility_id: f.facility_id,
        contact_id: f.contact!.id,
        purpose: "availability",
        wave,
        rank: called.size + i + 1,
        distance_km: f.distance_km,
        eta_minutes: f.eta_minutes,
        rank_reasons: f.rank_reasons,
        to_number: f.contact!.phone_e164,
        call_language: f.call_language,
      });
      if (a) inserted.push(a);
    }
    await EventRepository.add(r.id, "wave_dispatched", { wave, facility_ids: inserted.map((a) => a.facility_id) });
    await Promise.allSettled(inserted.map((a) => CallService.dispatchCall(ctx, a)));
    if (env.whatsappAvailabilityPing) await CallService.sendBedRequests(ctx, inserted);
    return inserted;
  },

  /**
   * C6: the same bed request on WhatsApp, for desks that prefer to reply there ("YES R-4821").
   * Sent after the calls are placed, so it never delays them. Carries no patient identifiers.
   */
  sendBedRequests: async (ctx: ReferralCtx, attempts: Attempt[]): Promise<void> => {
    const facilities = await FacilityRepository.getMany(attempts.map((a) => a.facility_id).filter((id): id is string => !!id));
    const rendered = bedRequestMessage({
      code: ctx.referral.code,
      doctor_name: withoutDemoTag(ctx.referrer.name),
      referring_facility: withoutDemoTag(ctx.origin?.name ?? ""),
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
  },

  /** Places one Bolna call for a queued attempt. False when dispatch failed; the attempt is then marked failed and an alert raised. */
  dispatchCall: async (ctx: ReferralCtx, attempt: Attempt, opts: { consented_test?: boolean } = {}): Promise<boolean> => {
    const r = ctx.referral;
    const facility = attempt.facility_id ? await FacilityRepository.get(attempt.facility_id) : null;
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
      const accepted = attempt.parent_attempt_id ? await CallRepository.get(attempt.parent_attempt_id) : null;
      userData = holdConfirmUserData(callCtx, {
        case_summary_short: shortSummaryOf(ctx),
        bed_type: accepted?.bed_type ?? null,
        accepted_by: accepted?.contact_person ?? null,
        eta_minutes: attempt.eta_minutes,
      });
    } else if (attempt.purpose === "family_update") {
      const patient = await ReferralRepository.patient(r.id);
      // The attendant's real number stays in patient_details; the attempt row only holds a masked copy.
      recipient = patient?.attendant_phone_e164 ?? "";
      userData = familyUserData(callCtx, {
        attendant_name: patient?.attendant_name ?? null,
        hospital_area: facilityArea(facility) || (facility?.name ?? ""),
        eta_minutes: attempt.eta_minutes,
      });
    } else {
      userData = releaseUserData(callCtx, { case_summary_short: shortSummaryOf(ctx, false) });
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
      await CallRepository.update(attempt.id, {
        bolna_execution_id: res.execution_id,
        bolna_agent_id: r.is_simulated ? "simulation" : agentId,
        bolna_status: res.status ?? "queued",
        dispatched_at: now(),
      });
      await EventRepository.add(r.id, "call_queued", { facility_id: attempt.facility_id, purpose: attempt.purpose, status: "queued" }, attempt.id);
      return true;
    } catch (err) {
      await CallRepository.casStatus(attempt, "failed", { termination_reason: "dispatch_error", ended_at: now() });
      const payload = {
        kind: err instanceof BolnaError && err.httpStatus === 429 ? "concurrency_or_activation" : "dispatch_failed",
        facility_id: attempt.facility_id,
        // A provider error can echo the number it dialled (for a family call, the attendant's).
        message: redactNumbers(err instanceof Error ? err.message : String(err)),
      };
      await EventRepository.add(r.id, "alert", payload, attempt.id);
      return false;
    }
  },

  /** Calls the same hospital again on `target`. Null when this attempt was already redialed (by a concurrent evaluation). */
  redial: async (ctx: ReferralCtx, parent: Attempt, target: DialTarget, reason: string): Promise<Attempt | null> => {
    const a = await CallRepository.insert({
      ...followOnOf(parent),
      contact_id: target.contact_id,
      parent_attempt_id: parent.id,
      purpose: "availability",
      rank_reasons: parent.rank_reasons,
      to_number: target.to_number,
    });
    if (!a) return null;
    await EventRepository.add(parent.referral_id, "redial_dispatched", { facility_id: parent.facility_id, reason }, a.id);
    await CallService.dispatchCall(ctx, a);
    return a;
  },

  /** Tells a hospital that said yes that it needn't keep the bed. False when it was already released. */
  release: async (ctx: ReferralCtx, acceptor: Attempt): Promise<boolean> => {
    const a = await CallRepository.insert({
      ...followOnOf(acceptor),
      contact_id: acceptor.contact_id,
      parent_attempt_id: acceptor.id,
      purpose: "release",
      to_number: acceptor.to_number,
    });
    if (!a) return false;
    await EventRepository.add(acceptor.referral_id, "release_dispatched", { facility_id: acceptor.facility_id }, a.id);
    await CallService.dispatchCall(ctx, a);
    return true;
  },

  /**
   * Dials a queued hold call exactly once: it is claimed by marking it, so concurrent evaluations can't both dial.
   * When the call can't be placed, the choice goes back to the doctor with an alert.
   */
  dispatchHold: async (ctx: ReferralCtx, hold: Attempt): Promise<boolean> => {
    const claimed = await CallRepository.update(hold.id, { bolna_status: "dispatching" }, { bolna_status: null, status: "queued" });
    if (!claimed) return false;
    const ok = await CallService.dispatchCall(ctx, claimed);
    if (!ok) {
      await ReferralRepository.reopenChoice(ctx.referral.id);
      await EventRepository.add(ctx.referral.id, "alert", {
        kind: "hold_call_failed",
        facility_id: hold.facility_id,
        message: "Couldn't place the confirmation call. Call the desk, then use “I already confirmed by phone”.",
      });
    }
    return ok;
  },

  /**
   * C1: a voice call to the attendant in their language after the bed is confirmed (and again on a missed call, C3).
   * Live calls need BOLNA_AGENT_ID_FAMILY; simulated referrals always place one. At most one every FAMILY_CALL_GAP_MIN.
   * Null when no call was placed.
   */
  dispatchFamilyCall: async (r: Referral, reason: "handoff" | "missed_call"): Promise<Attempt | null> => {
    if (!r.is_simulated && !env.agentId("family_update")) return null;
    if (!r.selected_attempt_id) return null;
    const patient = await ReferralRepository.patient(r.id);
    if (!patient?.attendant_phone_e164) return null;
    if (await CallRepository.hasFamilyCallSince(r.id, addMinutes(now(), -FAMILY_CALL_GAP_MIN))) return null;
    const selected = await CallRepository.get(r.selected_attempt_id);
    const a = await CallRepository.insert({
      referral_id: r.id,
      facility_id: r.selected_facility_id,
      purpose: "family_update",
      eta_minutes: selected?.eta_minutes ?? null,
      to_number: maskPhone(patient.attendant_phone_e164),
      call_language: patient.attendant_language,
    });
    if (!a) return null;
    await EventRepository.add(r.id, "family_call_dispatched", { reason }, a.id);
    await CallService.dispatchCall(await ReferralRepository.context(r), a);
    return a;
  },

  /**
   * A desk said yes after the patient was placed (or the referral was cancelled). The agent tells them on the same
   * call, so that is recorded as their release instead of phoning them again a minute later.
   */
  recordInCallRelease: async (acceptor: Attempt): Promise<void> => {
    const rel = await CallRepository.insert({
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
    if (!rel) return;
    const t = now();
    await CallRepository.update(rel.id, {
      status: "completed",
      bolna_status: "in_call",
      outcome: "release_ack",
      outcome_source: "function",
      outcome_at: t,
      ended_at: t,
    });
    await EventRepository.add(acceptor.referral_id, "release_dispatched", { facility_id: acceptor.facility_id, in_call: true }, rel.id);
  },

  /** The doctor records what a desk told them by phone. The doctor's record wins over the call's (CLAUDE.md rule 10). */
  recordManualOutcome: async (attemptId: string, m: ManualOutcome): Promise<Attempt | null> => {
    const a = await CallRepository.get(attemptId);
    if (!a) throw ApiError.notFound("Attempt not found");
    if (a.purpose !== "availability") throw ApiError.conflict("WRONG_PURPOSE", "Manual outcomes are for availability calls");
    const updated = await CallRepository.update(a.id, {
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
    await EventRepository.add(a.referral_id, "outcome_recorded", {
      facility_id: a.facility_id,
      outcome: m.outcome,
      bed_type: m.bed_type || null,
      ready_in_minutes: m.ready_in_minutes ?? null,
      source: "manual",
    }, a.id);
    const r = await ReferralRepository.get(a.referral_id);
    if (r && updated && isAcceptance(updated)) await ReferralService.markFirstAcceptance(r, updated);
    if (updated) await checkPortalMismatch(updated);
    await ReferralService.evaluate(a.referral_id);
    return updated;
  },

  /** The doctor redials a hospital on a directory number or a new one. Limited to MAX_REDIALS_PER_FACILITY per hospital. */
  redialManually: async (attemptId: string, target: { contact_id?: string; to_number?: string }): Promise<Attempt> => {
    const a = await CallRepository.get(attemptId);
    if (!a || a.purpose !== "availability") throw ApiError.notFound("Attempt not found");
    const r = await ReferralRepository.get(a.referral_id);
    if (!r || !ACTIVE.includes(r.status)) throw ApiError.conflict("NOT_ACTIVE", "Referral is not searching");
    const siblings = (await CallRepository.listForReferral(r.id)).filter((x) => x.purpose === "availability" && x.facility_id === a.facility_id);
    if (siblings.filter((x) => x.parent_attempt_id).length >= MAX_REDIALS_PER_FACILITY) {
      throw ApiError.tooMany("REDIAL_LIMIT", "Already redialed this hospital twice for this referral");
    }
    let to: DialTarget;
    if (target.contact_id) {
      const c = await FacilityRepository.getContact(target.contact_id);
      if (!c || c.facility_id !== a.facility_id) throw ApiError.unprocessable("BAD_CONTACT", "Contact not found for this hospital");
      to = { to_number: c.phone_e164, contact_id: c.id };
    } else {
      const phone = normalizePhone(target.to_number);
      if (!phone) throw ApiError.unprocessable("BAD_NUMBER", "Not a valid phone number");
      to = { to_number: phone, contact_id: await FacilityRepository.addUnverifiedContact(a.facility_id, phone, "other") };
    }
    const child = await CallService.redial(await ReferralRepository.context(r), a, to, "manual");
    if (!child) throw ApiError.conflict("ALREADY_REDIALED", "This call was already redialed; redial the latest attempt");
    return child;
  },
};
