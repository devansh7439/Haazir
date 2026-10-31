import "server-only";
import { CALLBACK_MAX_MIN, INBOUND_MATCH_WINDOW_MIN, MAX_REDIALS_PER_FACILITY } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { cleanParams, normalizeBedType, normalizeOutcome, normalizePhone, normalizeReferralCode, normalizeYesNo, parseMinutes } from "@/lib/core/normalize";
import type { Attempt, Purpose } from "@/lib/core/types";
import { checkPortalMismatch } from "@/lib/portal";
import { spokenName } from "@/lib/summary";
import { isAcceptance } from "@/lib/modules/call/call.helper";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { noFollowUp, type FollowUp, type FunctionResult, type Source } from "@/lib/modules/call/call.type";
import { SAFE_END, callbackInstruction, isContradictoryYes, isUuid, lateYesReason, responsePlan } from "@/lib/modules/call/function.helper";
import { WebhookLogRepository } from "@/lib/modules/call/webhook.repository";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";

type Params = Record<string, unknown>;

const notFound: FunctionResult = { result: "not_found", instruction: SAFE_END, followUp: noFollowUp };

/**
 * The call a function is about: by attempt_id when Bolna filled it in, otherwise the latest open call to the number it
 * dialled. An id for the wrong kind of call (e.g. a hold call's id sent to record_hospital_response) is never applied.
 */
const resolveAttempt = async (attemptId: string | null, toNumber: string | null, purposes: Purpose[]): Promise<Attempt | null> => {
  if (isUuid(attemptId)) {
    const a = await CallRepository.get(attemptId);
    if (a) return purposes.includes(a.purpose) ? a : null;
  }
  const phone = normalizePhone(toNumber);
  return phone ? CallRepository.findOpenByNumber(phone, purposes) : null;
};

/** The referring doctor's name as the agent says it, or "the referring doctor". */
const doctorName = async (referralId: string): Promise<string> => {
  const r = await ReferralRepository.get(referralId);
  const doc = r ? await ReferralRepository.referrer(r.referrer_id) : null;
  return doc ? spokenName(doc.name) : "the referring doctor";
};

const evaluateLater = (referralId: string): FollowUp => async () => {
  await ReferralService.evaluate(referralId);
};

/**
 * Bolna's mid-call custom functions (docs/04-api-spec.md §3). The routes and the simulator both call these, so a
 * simulated referral runs exactly the same code (CLAUDE.md rule 8). The answer is written before responding, so the
 * board turns green while the call is still live; everything else runs in `followUp`.
 */
export const FunctionService = {
  /** record_hospital_response: the desk's answer to "can you take this patient?". */
  recordResponse: async (raw: Params, source: Source = "function"): Promise<FunctionResult> => {
    const p = cleanParams({
      attempt_id: raw.attempt_id,
      outcome: raw.outcome,
      bed_type: raw.bed_type,
      specialist_available: raw.specialist_available,
      ready_in_minutes: raw.ready_in_minutes,
      contact_person: raw.contact_person,
      conditions: raw.conditions,
      decline_reason: raw.decline_reason,
      alternate_number: raw.alternate_number,
      to_number: raw.to_number,
    });
    const attempt = await resolveAttempt(p.attempt_id, p.to_number, ["availability"]);
    if (!attempt) return notFound;

    const outcome = normalizeOutcome(p.outcome);
    // "none" is a real bed_type answer ("no bed"), unlike Python's "None" for a missing value, which clean() drops.
    const bedType = String(raw.bed_type ?? "").trim() === "none" ? "none" : normalizeBedType(p.bed_type);
    const contradictory = isContradictoryYes(outcome, bedType);
    const alternate = outcome === "redirected" ? normalizePhone(p.alternate_number) : null;
    const updated = await CallRepository.recordAvailability(attempt.id, {
      outcome,
      source,
      bed_type: bedType,
      specialist_available: p.specialist_available,
      ready_in_minutes: parseMinutes(p.ready_in_minutes),
      contact_person: p.contact_person,
      conditions: p.conditions,
      decline_reason: p.decline_reason,
      alternate_number: alternate ?? p.alternate_number,
      needs_review: contradictory,
    });
    if (updated) {
      const recorded = { facility_id: attempt.facility_id, outcome, bed_type: updated.bed_type, ready_in_minutes: updated.ready_in_minutes, source };
      await EventRepository.add(attempt.referral_id, "outcome_recorded", recorded, attempt.id);
      if (contradictory) {
        const review = { facility_id: attempt.facility_id, function_outcome: outcome, extraction_outcome: "no bed available" };
        await EventRepository.add(attempt.referral_id, "needs_review", review, attempt.id);
      } else if (isAcceptance(updated)) {
        const r = await ReferralRepository.get(attempt.referral_id);
        if (r) await ReferralService.markFirstAcceptance(r, updated);
      }
    }

    const doctor = await doctorName(attempt.referral_id);
    const late = lateYesReason(await ReferralRepository.get(attempt.referral_id), attempt.id);
    const plan = responsePlan({ outcome, contradictory, late, doctor, alternate, recorded: !!updated });
    if (plan.releaseInCall && updated) await CallService.recordInCallRelease(updated);

    const followUp: FollowUp = async () => {
      if (updated) await checkPortalMismatch(updated);
      if (plan.redialTo && updated) {
        const contactId = await FacilityRepository.addUnverifiedContact(attempt.facility_id, plan.redialTo, "other");
        const r = await ReferralRepository.get(attempt.referral_id);
        const target = { to_number: plan.redialTo, contact_id: contactId };
        if (r) await CallService.redial(await ReferralRepository.context(r), updated, target, "redirected");
      }
      await ReferralService.evaluate(attempt.referral_id);
    };
    return { result: "recorded", instruction: plan.instruction, followUp };
  },

  /** request_doctor_callback: the desk wants to talk to the referring doctor. */
  requestDoctor: async (raw: Params, source: Source = "function"): Promise<FunctionResult> => {
    const p = cleanParams({
      attempt_id: raw.attempt_id,
      reason: raw.reason,
      contact_person: raw.contact_person,
      callback_number: raw.callback_number,
      to_number: raw.to_number,
    });
    const attempt = await resolveAttempt(p.attempt_id, p.to_number, ["availability"]);
    if (!attempt) return notFound;
    const updated = await CallRepository.recordNeedsDoctor(attempt.id, source, p.contact_person, p.reason);
    if (updated) {
      const facility = attempt.facility_id ? await FacilityRepository.get(attempt.facility_id) : null;
      await EventRepository.add(attempt.referral_id, "doctor_callback_requested", {
        facility_id: attempt.facility_id,
        facility_name: facility ? spokenName(facility.name) : null,
        number: normalizePhone(p.callback_number) ?? attempt.to_number,
        contact_person: p.contact_person,
        reason: p.reason,
      }, attempt.id);
    }
    const doctor = await doctorName(attempt.referral_id);
    return {
      result: "doctor_alerted",
      instruction: `Tell them ${doctor} will call them back on this number within about two minutes, thank them, and end the call.`,
      followUp: evaluateLater(attempt.referral_id),
    };
  },

  /** request_callback: the desk asks to be called back in a few minutes. After MAX_REDIALS_PER_FACILITY the doctor is asked instead. */
  requestCallback: async (raw: Params, source: Source = "function"): Promise<FunctionResult> => {
    const p = cleanParams({ attempt_id: raw.attempt_id, minutes: raw.minutes, contact_person: raw.contact_person, to_number: raw.to_number });
    const attempt = await resolveAttempt(p.attempt_id, p.to_number, ["availability"]);
    if (!attempt) return notFound;
    if ((await CallRepository.countRedials(attempt.referral_id, attempt.facility_id)) >= MAX_REDIALS_PER_FACILITY) {
      // Respect the desk: after two callbacks the doctor calls them directly.
      const handOver = { attempt_id: attempt.id, reason: "asked to be called back again", contact_person: p.contact_person, to_number: p.to_number };
      return FunctionService.requestDoctor(handOver, source);
    }
    const minutes = Math.min(Math.max(parseMinutes(p.minutes) ?? 5, 1), CALLBACK_MAX_MIN);
    const due = addMinutes(now(), minutes);
    if (await CallRepository.recordCallback(attempt.id, source, due, p.contact_person)) {
      const scheduled = { facility_id: attempt.facility_id, due_at: due.toISOString() };
      await EventRepository.add(attempt.referral_id, "callback_scheduled", scheduled, attempt.id);
    }
    return { result: "callback_scheduled", instruction: callbackInstruction(minutes), followUp: evaluateLater(attempt.referral_id) };
  },

  /** record_hold_confirmation: the chosen hospital confirms (or withdraws) the bed. */
  recordHold: async (raw: Params, source: Source = "function"): Promise<FunctionResult> => {
    const p = cleanParams({
      attempt_id: raw.attempt_id,
      confirmed: raw.confirmed,
      contact_person: raw.contact_person,
      whatsapp_number: raw.whatsapp_number,
      notes: raw.notes,
      to_number: raw.to_number,
    });
    const hold = await resolveAttempt(p.attempt_id, p.to_number, ["hold_confirm"]);
    if (!hold || hold.purpose !== "hold_confirm") return notFound;
    const confirmed = normalizeYesNo(p.confirmed);
    if (!confirmed) return { result: "unclear", instruction: "Thank them and end the call.", followUp: noFollowUp };
    const result = { confirmed, contact_person: p.contact_person, whatsapp_number: p.whatsapp_number, notes: p.notes };
    const followUp = await ReferralService.applyHoldResult(hold, result, source);
    return {
      result: "recorded",
      instruction: confirmed === "yes"
        ? "Thank them, say the pre-arrival note is coming on WhatsApp, and end the call."
        : "Thank them for letting us know, and end the call.",
      followUp,
    };
  },

  /** report_inbound_callback: a hospital called our number back. Matched by referral code, else by the number that called. */
  inboundCallback: async (raw: Params): Promise<FunctionResult> => {
    const p = cleanParams({ hospital_name: raw.hospital_name, referral_code: raw.referral_code, message: raw.message, from_number: raw.from_number });
    const code = normalizeReferralCode(p.referral_code);
    const from = normalizePhone(p.from_number);
    let referralId: string | null = code ? ((await ReferralRepository.getByCode(code))?.id ?? null) : null;
    let facilityName = p.hospital_name;
    if (from) {
      const recent = await CallRepository.latestToNumber(from, addMinutes(now(), -INBOUND_MATCH_WINDOW_MIN));
      if (recent) {
        referralId ??= recent.referral_id;
        if (recent.name) facilityName = spokenName(recent.name);
      }
    }
    if (referralId) {
      await EventRepository.add(referralId, "inbound_callback", { facility_name: facilityName, number: from, message: p.message });
    } else {
      await WebhookLogRepository.log(null, "inbound_callback_unmatched", { hospital_name: p.hospital_name, code, from_number: from });
    }
    return {
      result: "doctor_alerted",
      instruction: "Tell them the referring doctor will call them back right away, thank them, and end the call.",
      followUp: noFollowUp,
    };
  },
};
