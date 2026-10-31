import "server-only";
import { now } from "@/lib/core/clock";
import type { Attempt, Referral } from "@/lib/core/types";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { isInert, planEvaluation } from "@/lib/modules/referral/referral.helper";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import type { EvaluationStep, ReferralCtx } from "@/lib/modules/referral/referral.type";

const exhaust = async (id: string, actions: string[]): Promise<void> => {
  if (await ReferralRepository.update(id, { status: "exhausted" }, ["searching"])) {
    await EventRepository.addOnce(id, "referral_exhausted", { reason: "all waves finished with no acceptance" });
    actions.push("exhausted");
  }
};

/** Applies one planned step; every step is guarded, so a step another evaluation already did changes nothing. */
const applyStep = async (
  step: EvaluationStep,
  r: Referral,
  getCtx: () => Promise<ReferralCtx>,
  setCtx: (ctx: ReferralCtx) => void,
  actions: string[],
): Promise<void> => {
  switch (step.kind) {
    case "release":
      if (await CallService.release(await getCtx(), step.attempt)) actions.push(`release:${step.attempt.facility_id}`);
      return;
    case "dispatch_hold":
      if (await CallService.dispatchHold(await getCtx(), step.hold)) actions.push("hold_call_dispatched");
      return;
    case "first_acceptance":
      if (await EvaluationService.markFirstAcceptance(r, step.attempt)) actions.push("first_acceptance");
      return;
    case "options_ready":
      if (await ReferralRepository.update(r.id, { status: "options_ready" }, ["searching", "exhausted"])) actions.push("options_ready");
      return;
    case "back_to_searching":
      if (await ReferralRepository.update(r.id, { status: "searching" }, ["options_ready"])) actions.push("back_to_searching");
      return;
    case "redial":
      if (await CallService.redial(await getCtx(), step.attempt, step.target, step.reason)) {
        actions.push(`redial_${step.reason}:${step.attempt.facility_id}`);
      }
      return;
    case "next_wave": {
      const claimed = await ReferralRepository.claimWave(r.id, step.expectedWave);
      if (!claimed) return;
      const ctx = await ReferralRepository.context(claimed);
      setCtx(ctx);
      const sent = await CallService.dispatchWave(ctx, claimed.current_wave);
      actions.push(`wave_${claimed.current_wave}_dispatched:${sent.length}`);
      if (sent.length === 0 && step.exhaustIfEmpty) await exhaust(r.id, actions);
      return;
    }
    case "exhaust":
      await exhaust(r.id, actions);
      return;
    case "hold_expired":
      if (await EventRepository.addOnce(r.id, "hold_expired", { facility_id: r.selected_facility_id })) actions.push("hold_expired");
      return;
  }
};

/** Keeps a referral moving: plans what is due from a snapshot and applies it (docs/02-architecture.md §6.3). */
export const EvaluationService = {
  /**
   * Brings a referral up to date: plans the steps from a snapshot (referral.helper planEvaluation) and applies them.
   * Idempotent; runs after every webhook and function call, and on every tick. Returns what it did, e.g. ["release:<id>"].
   */
  evaluate: async (id: string): Promise<string[]> => {
    const r = await ReferralRepository.get(id);
    if (!r || isInert(r)) return [];
    const attempts = await CallRepository.listForReferral(id);
    const facilityIds = [...new Set(attempts.filter((a) => a.purpose === "availability").map((a) => a.facility_id).filter((x): x is string => !!x))];
    const contacts = await FacilityRepository.contactsByFacility(facilityIds);
    const steps = planEvaluation({ referral: r, attempts, contacts }, now());

    const actions: string[] = [];
    let ctx: ReferralCtx | null = null;
    const getCtx = async () => (ctx ??= await ReferralRepository.context(r));
    for (const step of steps) await applyStep(step, r, getCtx, (next) => (ctx = next), actions);
    return actions;
  },

  /** Sets the time to first acceptance exactly once and moves searching to options_ready. False when it was already set. */
  markFirstAcceptance: async (r: Referral, attempt: Attempt): Promise<boolean> => {
    const at = attempt.outcome_at ? new Date(attempt.outcome_at) : now();
    if (!(await ReferralRepository.setFirstAcceptance(r.id, at))) return false;
    await EventRepository.addOnce(r.id, "options_ready", {
      facility_id: attempt.facility_id,
      ttfa_seconds: Math.floor((at.getTime() - new Date(r.created_at).getTime()) / 1000),
    }, attempt.id);
    return true;
  },
};
