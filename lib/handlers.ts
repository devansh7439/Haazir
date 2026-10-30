import "server-only";
import { CALLBACK_MAX_MIN, LOST_TRACK_AFTER_S, POLL_EVERY_S, STALE_AFTER_S } from "./config";
import { getExecution, isSimulatedExecution } from "./bolna";
import { addMinutes, now, secondsBetween } from "./clock";
import { one, q } from "./db";
import { addEvent } from "./events";
import { clean, cleanParams, normalizeBedType, normalizeOutcome, normalizePhone, normalizeReferralCode, normalizeYesNo, parseMinutes } from "./normalize";
import {
  addContact, applyHoldResult, evaluateReferral, holdUnconfirmed, isAcceptance, markFirstAcceptance, redial, loadCtx,
} from "./orchestrator";
import {
  bumpContactStats, casAttemptStatus, findAttemptByExecution, findOpenAttemptByNumber, getAttempt, getFacility,
  getReferral, getReferralByCode, getReferrer, logRaw, updateAttempt,
} from "./repo";
import { canTransition, isTerminal, mapBolnaStatus } from "./statusMap";
import { checkPortalMismatch } from "./portal";
import { spokenName } from "./summary";
import type { Attempt, AvailabilityOutcome } from "./types";

// Bolna webhook and custom-function logic. The HTTP routes and the simulator both call these, so a simulated
// referral exercises exactly the same code as a real one (docs/02-architecture.md §10).

export type Source = "function" | "simulation" | "whatsapp";
type FollowUp = () => Promise<void>;
const noop: FollowUp = async () => {};

export interface FunctionResult {
  result: string;
  instruction: string;
  followUp: FollowUp;
}

const SAFE_END = "Thank them for their help and end the call.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveAttempt(attemptId: string | null, toNumber: string | null, purposes: string[]): Promise<Attempt | null> {
  if (attemptId && UUID.test(attemptId)) {
    const a = await getAttempt(attemptId);
    if (a) return a;
  }
  // Fallback when Bolna didn't fill %(attempt_id)s: the latest open attempt to the number it called.
  const phone = normalizePhone(toNumber);
  return phone ? findOpenAttemptByNumber(phone, purposes) : null;
}

async function doctorName(referralId: string): Promise<string> {
  const r = await getReferral(referralId);
  const doc = r ? await getReferrer(r.referrer_id) : null;
  return doc ? spokenName(doc.name) : "the referring doctor";
}

// ------------------------------------------------------------------ record_hospital_response

export async function handleRecordResponse(raw: Record<string, unknown>, source: Source = "function"): Promise<FunctionResult> {
  const p = cleanParams({
    attempt_id: raw.attempt_id, outcome: raw.outcome, bed_type: raw.bed_type, specialist_available: raw.specialist_available,
    ready_in_minutes: raw.ready_in_minutes, contact_person: raw.contact_person, conditions: raw.conditions,
    decline_reason: raw.decline_reason, alternate_number: raw.alternate_number, to_number: raw.to_number,
  });
  const attempt = await resolveAttempt(p.attempt_id, p.to_number, ["availability"]);
  if (!attempt) return { result: "not_found", instruction: SAFE_END, followUp: noop };

  const outcome: AvailabilityOutcome = normalizeOutcome(p.outcome);
  const alternate = outcome === "redirected" ? normalizePhone(p.alternate_number) : null;
  const t = now();
  // Compare-and-set on the outcome: a repeated call with the same answer changes nothing.
  const updated = await one<Attempt>(
    `update call_attempts set
       outcome = $2, outcome_source = $3, bed_type = $4, specialist_available = $5, ready_in_minutes = $6,
       contact_person = $7, conditions = $8, decline_reason = $9, alternate_number = $10,
       outcome_at = $11, answered_at = coalesce(answered_at, $11), updated_at = $11
     where id = $1 and outcome is distinct from $2
     returning *`,
    [
      attempt.id, outcome, source, normalizeBedType(p.bed_type), p.specialist_available, parseMinutes(p.ready_in_minutes),
      p.contact_person, p.conditions, p.decline_reason, alternate ?? p.alternate_number, t,
    ],
  );
  if (updated) {
    await addEvent(attempt.referral_id, "outcome_recorded", {
      facility_id: attempt.facility_id,
      outcome,
      bed_type: updated.bed_type,
      ready_in_minutes: updated.ready_in_minutes,
      source,
    }, attempt.id);
    if (isAcceptance(updated)) {
      const r = await getReferral(attempt.referral_id);
      if (r) await markFirstAcceptance(r, updated); // the board turns green while the call is still live
    }
  }
  const portalCheck = updated ? () => checkPortalMismatch(updated).then(() => undefined) : async () => {};

  const doc = await doctorName(attempt.referral_id);
  let instruction: string;
  let followUp: FollowUp = async () => {
    await portalCheck();
    await evaluateReferral(attempt.referral_id);
  };
  switch (outcome) {
    case "accepted":
    case "conditional":
      instruction = `Thank them, say ${doc}'s team will confirm within a few minutes if they send the patient, and end the call.`;
      break;
    case "declined":
      instruction = "Thank them for their time and end the call.";
      break;
    case "redirected":
      if (alternate && updated) {
        instruction = "Thank them, say you will call that number now, and end the call.";
        followUp = async () => {
          await portalCheck();
          const contactId = await addContact(attempt.facility_id, alternate, "other");
          const r = await getReferral(attempt.referral_id);
          if (r) await redial(await loadCtx(r), updated, { to_number: alternate, contact_id: contactId }, "redirected");
          await evaluateReferral(attempt.referral_id);
        };
      } else {
        instruction = "Thank them and end the call.";
      }
      break;
    default:
      instruction = "Thank them and end the call.";
  }
  return { result: "recorded", instruction, followUp };
}

// ------------------------------------------------------------------ request_doctor_callback

export async function handleRequestDoctor(raw: Record<string, unknown>, source: Source = "function"): Promise<FunctionResult> {
  const p = cleanParams({
    attempt_id: raw.attempt_id, reason: raw.reason, contact_person: raw.contact_person,
    callback_number: raw.callback_number, to_number: raw.to_number,
  });
  const attempt = await resolveAttempt(p.attempt_id, p.to_number, ["availability"]);
  if (!attempt) return { result: "not_found", instruction: SAFE_END, followUp: noop };
  const updated = await one<Attempt>(
    `update call_attempts set outcome = 'needs_doctor', outcome_source = $2, contact_person = coalesce($3, contact_person),
       conditions = $4, outcome_at = $5, answered_at = coalesce(answered_at, $5), updated_at = $5
     where id = $1 and outcome is distinct from 'needs_doctor' returning *`,
    [attempt.id, source, p.contact_person, p.reason, now()],
  );
  if (updated) {
    const facility = attempt.facility_id ? await getFacility(attempt.facility_id) : null;
    await addEvent(attempt.referral_id, "doctor_callback_requested", {
      facility_id: attempt.facility_id,
      facility_name: facility ? spokenName(facility.name) : null,
      number: normalizePhone(p.callback_number) ?? attempt.to_number,
      contact_person: p.contact_person,
      reason: p.reason,
    }, attempt.id);
  }
  const doc = await doctorName(attempt.referral_id);
  return {
    result: "doctor_alerted",
    instruction: `Tell them ${doc} will call them back on this number within about two minutes, thank them, and end the call.`,
    followUp: async () => { await evaluateReferral(attempt.referral_id); },
  };
}

// ------------------------------------------------------------------ request_callback

export async function handleRequestCallback(raw: Record<string, unknown>, source: Source = "function"): Promise<FunctionResult> {
  const p = cleanParams({ attempt_id: raw.attempt_id, minutes: raw.minutes, contact_person: raw.contact_person, to_number: raw.to_number });
  const attempt = await resolveAttempt(p.attempt_id, p.to_number, ["availability"]);
  if (!attempt) return { result: "not_found", instruction: SAFE_END, followUp: noop };
  const minutes = Math.min(Math.max(parseMinutes(p.minutes) ?? 5, 1), CALLBACK_MAX_MIN);
  const due = addMinutes(now(), minutes);
  const updated = await one<Attempt>(
    `update call_attempts set outcome = 'callback_later', outcome_source = $2, callback_due_at = $3,
       contact_person = coalesce($4, contact_person), outcome_at = $5, answered_at = coalesce(answered_at, $5), updated_at = $5
     where id = $1 and outcome is distinct from 'callback_later' returning *`,
    [attempt.id, source, due, p.contact_person, now()],
  );
  if (updated) {
    await addEvent(attempt.referral_id, "callback_scheduled", { facility_id: attempt.facility_id, due_at: due.toISOString() }, attempt.id);
  }
  return {
    result: "callback_scheduled",
    instruction: `Say you will call back in about ${minutes} minute${minutes === 1 ? "" : "s"}, thank them, and end the call.`,
    followUp: async () => { await evaluateReferral(attempt.referral_id); },
  };
}

// ------------------------------------------------------------------ record_hold_confirmation

export async function handleRecordHold(raw: Record<string, unknown>, source: Source = "function"): Promise<FunctionResult> {
  const p = cleanParams({
    attempt_id: raw.attempt_id, confirmed: raw.confirmed, contact_person: raw.contact_person,
    whatsapp_number: raw.whatsapp_number, notes: raw.notes, to_number: raw.to_number,
  });
  const hold = await resolveAttempt(p.attempt_id, p.to_number, ["hold_confirm"]);
  if (!hold || hold.purpose !== "hold_confirm") return { result: "not_found", instruction: SAFE_END, followUp: noop };
  const confirmed = normalizeYesNo(p.confirmed);
  if (!confirmed) return { result: "unclear", instruction: "Thank them and end the call.", followUp: noop };
  const followUp = await applyHoldResult(
    hold,
    { confirmed, contact_person: p.contact_person, whatsapp_number: p.whatsapp_number, notes: p.notes },
    source,
  );
  return {
    result: "recorded",
    instruction: confirmed === "yes"
      ? "Thank them, say the pre-arrival note is coming on WhatsApp, and end the call."
      : "Thank them for letting us know, and end the call.",
    followUp,
  };
}

// ------------------------------------------------------------------ report_inbound_callback

export async function handleInboundCallback(raw: Record<string, unknown>): Promise<FunctionResult> {
  const p = cleanParams({ hospital_name: raw.hospital_name, referral_code: raw.referral_code, message: raw.message, from_number: raw.from_number });
  const code = normalizeReferralCode(p.referral_code);
  const from = normalizePhone(p.from_number);
  let referralId: string | null = null;
  let facilityName = p.hospital_name;
  if (code) referralId = (await getReferralByCode(code))?.id ?? null;
  if (from) {
    const recent = await one<{ referral_id: string; name: string | null }>(
      `select a.referral_id, f.name from call_attempts a left join facilities f on f.id = a.facility_id
       where a.to_number = $1 and a.created_at > $2 order by a.created_at desc limit 1`,
      [from, addMinutes(now(), -120)],
    );
    if (recent) {
      referralId ??= recent.referral_id;
      if (recent.name) facilityName = spokenName(recent.name);
    }
  }
  if (referralId) {
    await addEvent(referralId, "inbound_callback", { facility_name: facilityName, number: from, message: p.message });
  } else {
    await logRaw(null, "inbound_callback_unmatched", { hospital_name: p.hospital_name, code, from_number: from });
  }
  return {
    result: "doctor_alerted",
    instruction: "Tell them the referring doctor will call them back right away, thank them, and end the call.",
    followUp: noop,
  };
}

// ------------------------------------------------------------------ status webhook

interface ExtractionValue {
  objective?: unknown;
  confidence_label?: unknown;
}

/** Case-insensitive lookup, since a renamed category in the dashboard silently breaks exact matches. */
function pick(obj: unknown, name: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const key = Object.keys(obj).find((k) => k.trim().toLowerCase() === name.toLowerCase());
  return key ? (obj as Record<string, unknown>)[key] : undefined;
}

function extraction(data: unknown, category: string, name: string): { value: string | null; confident: boolean } {
  const v = pick(pick(data, category), name) as ExtractionValue | string | undefined;
  if (v === undefined || v === null) return { value: null, confident: false };
  if (typeof v === "string") return { value: clean(v), confident: false };
  const label = String(v.confidence_label ?? "").toLowerCase();
  return { value: clean(v.objective), confident: label === "high" || label === "medium" };
}

const yes = (o: string | null) => o === "accepted" || o === "conditional";

async function reconcileAvailability(a: Attempt, body: Record<string, unknown>): Promise<void> {
  const data = a.extracted_data;
  const ex = extraction(data, "Referral outcome", "availability_outcome");
  const exOutcome = ex.value ? normalizeOutcome(ex.value) : null;
  const voicemail = a.termination_reason === "voicemail_reached" || body.answered_by_voice_mail === true;
  if (exOutcome) await updateAttempt(a.id, { extraction_outcome: exOutcome });

  if (a.outcome) {
    // A disagreement about whether the hospital said yes is never resolved automatically,
    // except that the doctor's own record (from talking to the desk) wins.
    if (exOutcome && a.outcome_source !== "manual" && yes(a.outcome) !== yes(exOutcome)) {
      await updateAttempt(a.id, { needs_review: true });
      await addEvent(a.referral_id, "needs_review", {
        facility_id: a.facility_id, function_outcome: a.outcome, extraction_outcome: exOutcome,
      }, a.id);
    }
    return;
  }

  let outcome: AvailabilityOutcome;
  const fields: Partial<Attempt> = {};
  if (voicemail || exOutcome === "ivr_blocked") outcome = "ivr_blocked";
  else if (exOutcome && ex.confident) {
    outcome = exOutcome;
    fields.bed_type = normalizeBedType(extraction(data, "Referral outcome", "bed_type").value);
    fields.ready_in_minutes = parseMinutes(extraction(data, "Referral outcome", "ready_in_minutes").value);
    fields.contact_person = extraction(data, "Referral outcome", "contact_person").value;
    fields.conditions = extraction(data, "Referral outcome", "conditions").value;
    const dr = extraction(data, "Referral outcome", "decline_reason").value;
    fields.decline_reason = dr === "not_applicable" ? null : dr;
  } else outcome = "unclear";

  const updated = await updateAttempt(
    a.id,
    { ...fields, outcome, outcome_source: "extraction", outcome_at: now() },
    { outcome: null },
  );
  if (!updated) return;
  await addEvent(a.referral_id, "outcome_recorded", {
    facility_id: a.facility_id, outcome, bed_type: updated.bed_type, ready_in_minutes: updated.ready_in_minutes, source: "extraction",
  }, a.id);
  if (isAcceptance(updated)) {
    const r = await getReferral(a.referral_id);
    if (r) await markFirstAcceptance(r, updated);
  }
  await checkPortalMismatch(updated);
}

async function reconcileOnTerminal(a: Attempt, body: Record<string, unknown>): Promise<FollowUp> {
  let followUp: FollowUp = noop;
  if (a.purpose === "availability" && a.status === "completed") {
    await reconcileAvailability(a, body);
  } else if (a.purpose === "hold_confirm") {
    if (a.status === "completed" && !a.outcome) {
      const ex = extraction(a.extracted_data, "Hold", "hold_confirmed");
      const answer = normalizeYesNo(ex.value);
      if (answer && ex.confident) {
        followUp = await applyHoldResult(
          a,
          { confirmed: answer, contact_person: extraction(a.extracted_data, "Hold", "contact_person").value, whatsapp_number: null, notes: null },
          "extraction",
        );
      }
    }
    const fresh = await getAttempt(a.id);
    if (fresh && !fresh.outcome) await holdUnconfirmed(fresh);
  } else if (a.status === "completed") {
    const outcome = a.purpose === "release" ? "release_ack" : "family_informed";
    await updateAttempt(a.id, { outcome, outcome_source: "extraction", outcome_at: now() }, { outcome: null });
  }
  const fresh = await getAttempt(a.id);
  // Simulated calls never count toward a desk's answer rate (it feeds the real ranking).
  if (!isSimulatedExecution(a.bolna_execution_id)) {
    await bumpContactStats(a.contact_id, !!fresh?.answered_at, fresh?.outcome ?? a.status);
  }
  return followUp;
}

export interface WebhookResult {
  ok: true;
  attempt_id: string | null;
  applied: boolean;
  followUp: FollowUp;
}

export async function handleWebhook(body: unknown, opts: { log?: boolean } = {}): Promise<WebhookResult> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const executionId = typeof b.id === "string" ? b.id : typeof b.execution_id === "string" ? b.execution_id : null;
  const rawStatus = typeof b.status === "string" ? b.status : null;
  if (opts.log !== false) await logRaw(executionId, rawStatus, b);

  let attempt = executionId ? await findAttemptByExecution(executionId) : null;
  if (!attempt) {
    const ctx = b.context_details as Record<string, unknown> | undefined;
    const fromCtx = clean(pick(pick(ctx, "recipient_data"), "attempt_id") ?? pick(ctx, "attempt_id") ?? pick(b.user_data, "attempt_id"));
    if (fromCtx && UUID.test(fromCtx)) attempt = await getAttempt(fromCtx);
  }
  if (!attempt) return { ok: true, attempt_id: null, applied: false, followUp: noop };
  const mapped = mapBolnaStatus(rawStatus);
  if (!mapped) return { ok: true, attempt_id: attempt.id, applied: false, followUp: noop };

  if (mapped.alert) {
    await addEvent(attempt.referral_id, "alert", {
      kind: mapped.alert,
      message: mapped.alert === "balance_low"
        ? "Bolna wallet balance is low: top up before the next call."
        : "Bolna rescheduled a call (calling guardrails are on). Turn off outbound calling hours.",
    }, attempt.id);
  }
  if (!canTransition(attempt.status, mapped.status)) {
    return { ok: true, attempt_id: attempt.id, applied: false, followUp: noop };
  }

  const t = now();
  const telephony = (b.telephony_data ?? {}) as Record<string, unknown>;
  const fields: Partial<Attempt> = { bolna_status: rawStatus };
  if (executionId && !attempt.bolna_execution_id) fields.bolna_execution_id = executionId;
  const termination = clean(b.termination_reason);
  if (termination) fields.termination_reason = termination;
  if (mapped.status === "dialing" && !attempt.dispatched_at) fields.dispatched_at = t;
  if (mapped.status === "in_progress" && !attempt.answered_at) fields.answered_at = t;
  if (mapped.status === "wrapping_up") fields.ended_at = t;
  if (isTerminal(mapped.status) && !attempt.ended_at) fields.ended_at = t;
  if (mapped.status === "completed") {
    // Final fields are only reliable at `completed`.
    fields.transcript = typeof b.transcript === "string" ? b.transcript : null;
    fields.recording_url = clean(telephony.recording_url);
    fields.extracted_data = b.extracted_data ?? null;
  }
  const updated = await casAttemptStatus(attempt, mapped.status, fields);
  if (!updated) return { ok: true, attempt_id: attempt.id, applied: false, followUp: noop }; // lost a race; the other writer wins

  const base = { facility_id: attempt.facility_id, purpose: attempt.purpose, status: mapped.status };
  if (mapped.status === "ringing") await addEvent(attempt.referral_id, "call_ringing", base, attempt.id);
  if (mapped.status === "in_progress") await addEvent(attempt.referral_id, "call_answered", base, attempt.id);
  let followUp: FollowUp = noop;
  if (isTerminal(mapped.status)) {
    await addEvent(attempt.referral_id, "call_ended", {
      ...base,
      termination_reason: termination,
      hangup_by: clean(telephony.hangup_by),
      hangup_reason: clean(telephony.hangup_reason),
    }, attempt.id);
    if (mapped.status === "failed") {
      await addEvent(attempt.referral_id, "alert", {
        kind: "call_failed", facility_id: attempt.facility_id, message: clean(b.error_message) ?? "Call failed",
      }, attempt.id);
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
      await evaluateReferral(referralId);
    },
  };
}

/** Last webhook and function call seen, for the Demo page. */
export async function lastBolnaContact(): Promise<{ last_webhook_at: string | null; last_function_at: string | null }> {
  const [w] = await q<{ at: Date | null }>(
    `select max(received_at) as at from bolna_webhook_log
     where status is null or (status not like 'function:%' and status not like 'poll:%' and status not like 'inbound_%')`,
  );
  const [f] = await q<{ at: Date | null }>(`select max(received_at) as at from bolna_webhook_log where status like 'function:%'`);
  return {
    last_webhook_at: w?.at ? new Date(w.at).toISOString() : null,
    last_function_at: f?.at ? new Date(f.at).toISOString() : null,
  };
}

// ------------------------------------------------------------------ missed-webhook recovery

/**
 * Asks Bolna for the status of real calls whose status hasn't moved for a while (a webhook may have been lost),
 * and feeds the answer through the normal webhook handler. Safe to run from every tick and the cron.
 */
export async function recoverStaleAttempts(referralId: string | null = null): Promise<number> {
  const t = now();
  const candidates = await q<Attempt>(
    `select * from call_attempts
     where status in ('queued','dialing','ringing','in_progress','wrapping_up')
       and bolna_execution_id is not null
       and bolna_execution_id not like 'sim\_%'
       and ($1::uuid is null or referral_id = $1)
       and (last_polled_at is null or last_polled_at < $2)
     order by updated_at limit 50`,
    [referralId, new Date(t.getTime() - POLL_EVERY_S * 1000)],
  );
  let recovered = 0;
  for (const a of candidates) {
    if (isSimulatedExecution(a.bolna_execution_id)) continue;
    if (secondsBetween(a.updated_at, t) < (STALE_AFTER_S[a.status] ?? 120)) continue;
    // Claim the poll so concurrent ticks don't both call Bolna.
    const claimed = await one(
      `update call_attempts set last_polled_at = $2 where id = $1 and last_polled_at is not distinct from $3 returning id`,
      [a.id, t, a.last_polled_at],
    );
    if (!claimed) continue;
    try {
      const execution = await getExecution(a.bolna_execution_id!);
      await logRaw(a.bolna_execution_id, `poll:${String(execution.status ?? "")}`, execution);
      const res = await handleWebhook({ ...execution, id: a.bolna_execution_id }, { log: false });
      await res.followUp();
      if (res.applied) {
        recovered++;
        await addEvent(a.referral_id, "status_recovered", { facility_id: a.facility_id, status: execution.status ?? null }, a.id);
      }
    } catch (err) {
      // Bolna can't tell us either. After long enough, stop showing the call as live.
      if (secondsBetween(a.dispatched_at ?? a.created_at, t) > LOST_TRACK_AFTER_S) {
        const failed = await updateAttempt(a.id, { status: "failed", termination_reason: "lost_track", ended_at: t }, { status: a.status });
        if (failed) {
          await addEvent(a.referral_id, "alert", {
            kind: "lost_track",
            facility_id: a.facility_id,
            message: "Lost track of a call: no status from Bolna for 15 minutes. Check it in the Bolna dashboard.",
          }, a.id);
          await evaluateReferral(a.referral_id);
        }
      }
      console.error("[haazir] status poll failed", err instanceof Error ? err.message : err);
    }
  }
  return recovered;
}
