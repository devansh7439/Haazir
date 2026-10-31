import "server-only";
import { env } from "@/lib/core/config";
import { now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { normalizePhone } from "@/lib/core/normalize";
import type { Attempt } from "@/lib/core/types";
import { doctorConfirmation, familyMessage, preArrivalNote } from "@/lib/modules/handoff/message.helper";
import { WhatsAppService } from "@/lib/modules/handoff/whatsapp.service";
import { isAcceptance, stillOnLine } from "@/lib/modules/call/call.helper";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { noFollowUp, type FollowUp, type OutcomeSource } from "@/lib/modules/call/call.type";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { CONFIRMABLE, SELECTABLE, handoffFacts, holdUntil } from "@/lib/modules/referral/referral.helper";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

/** A hold call's result, from the function, the call's extraction, the simulator or a WhatsApp reply. */
export interface HoldResult {
  confirmed: "yes" | "no";
  contact_person: string | null;
  whatsapp_number: string | null;
  notes: string | null;
}

/** Choosing a hospital and confirming its bed: the hold call, the manual confirmation and the handoff messages. */
export const HoldService = {
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
        await HoldService.sendHandoff(r.id);
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
      await HoldService.sendHandoff(r.id);
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
    // The family hears from us only if the doctor recorded that the attendant agreed (docs/09 §3).
    if (patient?.attendant_phone_e164 && patient.attendant_consent_at) {
      const rendered = familyMessage(facts, patient.attendant_language);
      await WhatsAppService.send({ referral_id: r.id, audience: "family", to: patient.attendant_phone_e164, rendered, simulated });
      if (env.familyCalls) await CallService.dispatchFamilyCall(r, "handoff");
    }
  },
};
