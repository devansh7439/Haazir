import "server-only";
import { LOST_TRACK_AFTER_S, POLL_EVERY_S, STALE_AFTER_S } from "@/lib/core/config";
import { now, secondsBetween } from "@/lib/core/clock";
import { createLogger } from "@/lib/core/logger";
import { clean, normalizeYesNo, redactNumbers } from "@/lib/core/normalize";
import type { Attempt } from "@/lib/core/types";
import { getExecution, isSimulatedExecution } from "@/lib/integrations/bolna/bolna.client";
import { PortalService } from "@/lib/modules/portal/portal.service";
import { isAcceptance } from "@/lib/modules/call/call.helper";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { noFollowUp, type FollowUp, type WebhookResult } from "@/lib/modules/call/call.type";
import { isUuid } from "@/lib/modules/call/function.helper";
import { canTransition, isTerminal, mapBolnaStatus } from "@/lib/modules/call/status.helper";
import { attemptIdOf, executionIdOf, extraction, prop, readAvailability, statusFields } from "@/lib/modules/call/webhook.helper";
import { WebhookLogRepository } from "@/lib/modules/call/webhook.repository";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";

const log = createLogger("call");

type Body = Record<string, unknown>;

const ignored = (attemptId: string | null): WebhookResult => ({ ok: true, attempt_id: attemptId, applied: false, followUp: noFollowUp });

/** Applies what a completed availability call's extraction says (webhook.helper readAvailability). */
const reconcileAvailability = async (a: Attempt, body: Body): Promise<void> => {
  const reading = readAvailability(a, body);
  if (reading.extractionOutcome) await CallRepository.update(a.id, { extraction_outcome: reading.extractionOutcome });

  if (reading.kind === "answered") {
    if (!reading.review) return;
    await CallRepository.update(a.id, { needs_review: true });
    const review = { facility_id: a.facility_id, function_outcome: a.outcome, extraction_outcome: reading.extractionOutcome };
    await EventRepository.add(a.referral_id, "needs_review", review, a.id);
    return;
  }

  const fields = { ...reading.fields, outcome: reading.outcome, outcome_source: "extraction" as const, outcome_at: now() };
  const updated = await CallRepository.update(a.id, fields, { outcome: null });
  if (!updated) return;
  await EventRepository.add(a.referral_id, "outcome_recorded", {
    facility_id: a.facility_id,
    outcome: reading.outcome,
    bed_type: updated.bed_type,
    ready_in_minutes: updated.ready_in_minutes,
    source: "extraction",
  }, a.id);
  if (isAcceptance(updated)) {
    const r = await ReferralRepository.get(a.referral_id);
    if (r) await EvaluationService.markFirstAcceptance(r, updated);
  }
  await PortalService.checkMismatch(updated);
};

/** What a call's end means, by purpose; returns follow-up work (a confirmed hold sends the handoff). */
const reconcileOnTerminal = async (a: Attempt, body: Body): Promise<FollowUp> => {
  let followUp: FollowUp = noFollowUp;
  if (a.purpose === "availability" && a.status === "completed") {
    await reconcileAvailability(a, body);
  } else if (a.purpose === "hold_confirm") {
    if (a.status === "completed" && !a.outcome) {
      const ex = extraction(a.extracted_data, "Hold", "hold_confirmed");
      const answer = normalizeYesNo(ex.value);
      if (answer && ex.confident) {
        const contactPerson = extraction(a.extracted_data, "Hold", "contact_person").value;
        const result = { confirmed: answer, contact_person: contactPerson, whatsapp_number: null, notes: null };
        followUp = await ReferralService.applyHoldResult(a, result, "extraction");
      }
    }
    const fresh = await CallRepository.get(a.id);
    if (fresh && !fresh.outcome) await ReferralService.holdUnconfirmed(fresh);
  } else if (a.status === "completed") {
    const outcome = a.purpose === "release" ? "release_ack" : "family_informed";
    await CallRepository.update(a.id, { outcome, outcome_source: "extraction", outcome_at: now() }, { outcome: null });
  }
  const fresh = await CallRepository.get(a.id);
  // Simulated calls never count toward a desk's answer rate (it feeds the real ranking).
  if (!isSimulatedExecution(a.bolna_execution_id)) {
    await CallRepository.bumpContactStats(a.contact_id, !!fresh?.answered_at, fresh?.outcome ?? a.status);
  }
  return followUp;
};

/** Bolna's status webhook (docs/04-api-spec.md §2) and missed-webhook recovery. */
export const WebhookService = {
  /**
   * Applies one status update. Statuses only move forward (CLAUDE.md rule 2), so a replayed or late webhook is
   * accepted and ignored (`applied: false`). `log: false` skips the raw log when the caller already stored it.
   */
  handle: async (body: unknown, opts: { log?: boolean } = {}): Promise<WebhookResult> => {
    const b: Body = body && typeof body === "object" ? (body as Body) : {};
    const executionId = executionIdOf(b);
    const rawStatus = typeof b.status === "string" ? b.status : null;
    if (opts.log !== false) await WebhookLogRepository.log(executionId, rawStatus, b);

    let attempt = executionId ? await CallRepository.findByExecution(executionId) : null;
    if (!attempt) {
      const fromContext = attemptIdOf(b);
      if (isUuid(fromContext)) attempt = await CallRepository.get(fromContext);
    }
    if (!attempt) return ignored(null);
    const mapped = mapBolnaStatus(rawStatus);
    if (!mapped) return ignored(attempt.id);

    if (mapped.alert) {
      const message = mapped.alert === "balance_low"
        ? "Bolna wallet balance is low: top up before the next call."
        : "Bolna rescheduled a call (calling guardrails are on). Turn off outbound calling hours.";
      await EventRepository.add(attempt.referral_id, "alert", { kind: mapped.alert, message }, attempt.id);
    }
    if (!canTransition(attempt.status, mapped.status)) return ignored(attempt.id);

    const updated = await CallRepository.casStatus(attempt, mapped.status, statusFields(attempt, mapped, b, rawStatus, now()));
    // Lost a race: the other writer wins.
    if (!updated) return ignored(attempt.id);

    const base = { facility_id: attempt.facility_id, purpose: attempt.purpose, status: mapped.status };
    if (mapped.status === "ringing") await EventRepository.add(attempt.referral_id, "call_ringing", base, attempt.id);
    if (mapped.status === "in_progress") await EventRepository.add(attempt.referral_id, "call_answered", base, attempt.id);
    let followUp: FollowUp = noFollowUp;
    if (isTerminal(mapped.status)) {
      await EventRepository.add(attempt.referral_id, "call_ended", {
        ...base,
        termination_reason: clean(b.termination_reason),
        hangup_by: clean(prop(b.telephony_data, "hangup_by")),
        hangup_reason: clean(prop(b.telephony_data, "hangup_reason")),
      }, attempt.id);
      if (mapped.status === "failed") {
        const message = redactNumbers(clean(b.error_message) ?? "Call failed");
        await EventRepository.add(attempt.referral_id, "alert", { kind: "call_failed", facility_id: attempt.facility_id, message }, attempt.id);
      }
      followUp = await reconcileOnTerminal(updated, b);
    }
    const referralId = attempt.referral_id;
    return {
      ok: true,
      attempt_id: attempt.id,
      applied: true,
      followUp: async () => {
        await followUp();
        await EvaluationService.evaluate(referralId);
      },
    };
  },

  /**
   * Asks Bolna about real calls whose status hasn't moved for a while (a webhook may have been lost) and feeds the
   * answer through `handle`. After LOST_TRACK_AFTER_S with no answer the call is marked failed. Safe to run from every
   * tick and the cron. Returns how many calls moved.
   */
  recoverStale: async (referralId: string | null = null): Promise<number> => {
    const t = now();
    const candidates = await CallRepository.staleCandidates(referralId, new Date(t.getTime() - POLL_EVERY_S * 1000));
    let recovered = 0;
    for (const a of candidates) {
      if (isSimulatedExecution(a.bolna_execution_id)) continue;
      if (secondsBetween(a.updated_at, t) < (STALE_AFTER_S[a.status] ?? 120)) continue;
      if (!(await CallRepository.claimPoll(a, t))) continue;
      try {
        const execution = await getExecution(a.bolna_execution_id!);
        await WebhookLogRepository.log(a.bolna_execution_id, `poll:${String(execution.status ?? "")}`, execution);
        const res = await WebhookService.handle({ ...execution, id: a.bolna_execution_id }, { log: false });
        await res.followUp();
        if (res.applied) {
          recovered++;
          await EventRepository.add(a.referral_id, "status_recovered", { facility_id: a.facility_id, status: execution.status ?? null }, a.id);
        }
      } catch (err) {
        // Bolna can't tell us either. After long enough, stop showing the call as live.
        if (secondsBetween(a.dispatched_at ?? a.created_at, t) > LOST_TRACK_AFTER_S) {
          const failed = await CallRepository.update(a.id, { status: "failed", termination_reason: "lost_track", ended_at: t }, { status: a.status });
          if (failed) {
            await EventRepository.add(a.referral_id, "alert", {
              kind: "lost_track",
              facility_id: a.facility_id,
              message: "Lost track of a call: no status from Bolna for 15 minutes. Check it in the Bolna dashboard.",
            }, a.id);
            await EvaluationService.evaluate(a.referral_id);
          }
        }
        log.error({ err, attemptId: a.id }, "Status poll failed");
      }
    }
    return recovered;
  },
};
