import { HOLD_BUFFER_MIN, HOLD_WAIT_MAX_S, MAX_WAVES, TIMEZONE, WAVE_TIMEOUT_S, env } from "@/lib/core/config";
import { addMinutes, secondsBetween } from "@/lib/core/clock";
import type { Attempt, Facility, Referral, ReferralStatus } from "@/lib/core/types";
import { facilityArea, isAcceptance, planRedial, stillOnLine, withoutDemoTag } from "@/lib/modules/call/call.helper";
import type { RedialPlan } from "@/lib/modules/call/call.type";
import { isTerminal } from "@/lib/modules/call/status.helper";
import type { HandoffFacts } from "@/lib/messages";
import type { EvaluationSnapshot, EvaluationStep, PatientDetails, ReferralCtx } from "@/lib/modules/referral/referral.type";
import { buildShortSummary, describeWho } from "@/lib/summary";

/** A hospital can be chosen while the search is open. */
export const SELECTABLE: ReferralStatus[] = ["options_ready", "searching", "exhausted"];
/** A bed can be marked confirmed by phone while choosing is open, or while a hold call is in progress. */
export const CONFIRMABLE: ReferralStatus[] = [...SELECTABLE, "confirming"];
/** Redials and callbacks only happen while the search is open. */
export const ACTIVE: ReferralStatus[] = ["searching", "options_ready", "exhausted"];
export const CANCELLABLE: ReferralStatus[] = ["searching", "options_ready", "confirming", "confirmed", "exhausted"];
export const CLOSABLE: ReferralStatus[] = [...CANCELLABLE, "cancelled"];

/** The case in one short spoken sentence ("Man aged 34, suspected snakebite, critical"), for hold and release calls. */
export const shortSummaryOf = (ctx: ReferralCtx, includeAcuity = true): string => {
  const r = ctx.referral;
  return buildShortSummary(
    { age_value: r.age_value, age_unit: r.age_unit, sex: r.sex, case_spoken: ctx.template.spoken_en, acuity: r.acuity },
    includeAcuity,
  );
};

/** How long the receiving hospital holds the bed: the drive plus HOLD_BUFFER_MIN. */
export const holdUntil = (now: Date, etaMinutes: number | null): Date => addMinutes(now, (etaMinutes ?? 0) + HOLD_BUFFER_MIN);

const timeFormat = new Intl.DateTimeFormat("en-IN", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });

/** A time as the doctor reads it, in India time: "14:05". */
export const formatTime = (d: Date | string): string => timeFormat.format(new Date(d));

/**
 * Whether a referral is past evaluating: a draft, or a test call closed by the Demo page.
 * Evaluation of such a referral plans nothing.
 */
export const isInert = (r: Pick<Referral, "status" | "close_reason">): boolean =>
  r.status === "draft" || (r.status === "closed" && r.close_reason === "test_call");

/**
 * The steps that bring a referral up to date, in the order they must run (docs/02-architecture.md §6.3).
 * Pure: it reads only the snapshot and `now`. Every step is guarded again when applied, so planning from a snapshot
 * that another evaluation is also acting on is safe.
 */
export const planEvaluation = ({ referral: r, attempts, contacts }: EvaluationSnapshot, now: Date): EvaluationStep[] => {
  if (isInert(r)) return [];
  const avail = attempts.filter((a) => a.purpose === "availability");
  const accepted = avail.filter((a) => isAcceptance(a) && !a.needs_review);
  // Includes answers under review: they may still be holding a bed.
  const anyAcceptance = avail.filter(isAcceptance);
  const released = (a: Attempt) => attempts.some((x) => x.purpose === "release" && x.parent_attempt_id === a.id);
  const releases = (keep: string | null): EvaluationStep[] =>
    anyAcceptance.filter((a) => a.id !== keep && !released(a)).map((attempt) => ({ kind: "release", attempt }));

  // Cancelled: release every hospital that said yes, including late answers.
  // Closed: the patient is placed; release anyone except the chosen hospital who said yes after that.
  if (r.status === "cancelled" || r.status === "closed") return releases(r.status === "closed" ? r.selected_attempt_id : null);

  const steps: EvaluationStep[] = [];

  // 0. A hold call waits until the accepting call has ended, so it doesn't ring a desk that is still on the line.
  if (r.status === "confirming") {
    for (const hold of attempts.filter((x) => x.purpose === "hold_confirm" && x.status === "queued" && !x.bolna_status)) {
      const parent = attempts.find((x) => x.id === hold.parent_attempt_id);
      const lineFree = !parent || !stillOnLine(parent);
      if (lineFree || secondsBetween(hold.created_at, now) >= HOLD_WAIT_MAX_S) steps.push({ kind: "dispatch_hold", hold });
    }
  }

  // 1. The first yes sets the time to first acceptance, once.
  if (accepted.length > 0 && !r.first_acceptance_at) {
    const first = [...accepted].sort((a, b) => +new Date(a.outcome_at ?? 0) - +new Date(b.outcome_at ?? 0))[0];
    steps.push({ kind: "first_acceptance", attempt: first });
  }
  let status = r.status;
  if (accepted.length > 0 && (status === "searching" || status === "exhausted")) steps.push({ kind: "options_ready" });
  if (accepted.length === 0 && status === "options_ready") {
    // The only yes was withdrawn (hold declined) or put under review: keep searching.
    steps.push({ kind: "back_to_searching" });
    status = "searching";
  }

  // 2–3. Due callbacks, one redial on busy, the next number on no answer.
  const plans = avail.map((a) => planRedial(a, attempts, contacts, now)).filter((p): p is RedialPlan => !!p);
  if (ACTIVE.includes(status)) {
    for (const p of plans) {
      if (p.due && p.target) steps.push({ kind: "redial", attempt: p.attempt, target: p.target, reason: p.reason });
    }
  }

  // 4. The next wave when this one is done or timed out; exhausted when the last wave is done.
  if (status === "searching" && accepted.length === 0) {
    const pending = new Set(plans.map((p) => p.attempt.id));
    const active = avail.filter((a) => !isTerminal(a.status) || pending.has(a.id));
    const timedOut = secondsBetween(r.wave_started_at, now) > WAVE_TIMEOUT_S;
    if ((active.length === 0 || timedOut) && r.current_wave < MAX_WAVES) {
      steps.push({ kind: "next_wave", expectedWave: r.current_wave, exhaustIfEmpty: active.length === 0 });
    } else if (active.length === 0 && r.current_wave >= MAX_WAVES) {
      steps.push({ kind: "exhaust" });
    }
  }

  // 5. Release hospitals that accepted but weren't chosen, including late acceptances.
  if (r.status === "confirmed") steps.push(...releases(r.selected_attempt_id));

  // 6. The hold has run out.
  if (r.status === "confirmed" && r.hold_expires_at && secondsBetween(r.hold_expires_at, now) > 0) steps.push({ kind: "hold_expired" });
  return steps;
};

/** Everything the pre-arrival note, the doctor's confirmation and the family message say (docs/06-ui-spec.md §5). */
export const handoffFacts = (input: {
  ctx: ReferralCtx;
  selected: Attempt;
  facility: Facility;
  patient: Pick<PatientDetails, "patient_name"> | null;
  contactPerson: string | null;
  now: Date;
}): HandoffFacts => {
  const { ctx, selected, facility, patient, contactPerson, now } = input;
  const r = ctx.referral;
  return {
    code: r.code,
    doctor_name: withoutDemoTag(ctx.referrer.name),
    doctor_phone: ctx.referrer.phone_e164,
    referring_facility: withoutDemoTag(ctx.origin?.name ?? ""),
    patient_name: patient?.patient_name ?? null,
    who: describeWho(r.age_value, r.age_unit, r.sex),
    case_label: ctx.template.label,
    acuity: r.acuity,
    note: r.note,
    needs_labels: ctx.needs.map((n) => n.label),
    eta_minutes: selected.eta_minutes,
    transport: r.transport,
    contact_person: contactPerson,
    confirmed_time: formatTime(r.confirmed_at ?? now),
    hospital_name: withoutDemoTag(facility.name),
    hospital_address: facilityArea(facility) || null,
    hospital_lat: facility.lat,
    hospital_lng: facility.lng,
    desk_number: selected.to_number,
    bed_type: selected.bed_type,
    conditions: selected.conditions,
    hold_until_time: formatTime(r.hold_expires_at ?? now),
    aapat_setu_url: env.aapatSetuUrl ? env.aapatSetuUrl.replace("{code}", encodeURIComponent(r.code)) : null,
  };
};
