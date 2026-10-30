// Client-safe display helpers (docs/06-ui-spec.md §2.1). Colour never carries meaning alone: every state has an icon and text.

export const LANGUAGE_LABEL: Record<string, string> = { en: "English", kn: "Kannada", hi: "Hindi", ta: "Tamil", te: "Telugu", ml: "Malayalam", mr: "Marathi" };

export const BED_LABEL: Record<string, string> = {
  icu_with_ventilator: "ICU + ventilator",
  icu: "ICU",
  hdu: "HDU",
  nicu: "NICU",
  emergency_only: "Emergency only",
  ward: "Ward",
  none: "No bed",
  unknown: "Bed type not stated",
};

export type Tone = "grey" | "blue" | "amber" | "green" | "green-cond" | "red" | "purple" | "slate" | "dark" | "orange" | "held";

/** pin: map marker colour · badge: soft pill · dot: status dot · accent: thin left rule on the card */
export const TONE: Record<Tone, { pin: string; badge: string; dot: string; accent: string }> = {
  grey: { pin: "#a1a1aa", badge: "bg-zinc-100 text-zinc-700 ring-zinc-200", dot: "bg-zinc-400", accent: "bg-zinc-200" },
  blue: { pin: "#0ea5e9", badge: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", accent: "bg-sky-400" },
  amber: { pin: "#f59e0b", badge: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500", accent: "bg-amber-400" },
  green: { pin: "#10b981", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", accent: "bg-emerald-500" },
  "green-cond": { pin: "#10b981", badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", accent: "bg-emerald-500" },
  red: { pin: "#f43f5e", badge: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", accent: "bg-rose-300" },
  purple: { pin: "#8b5cf6", badge: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500", accent: "bg-violet-500" },
  slate: { pin: "#64748b", badge: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-500", accent: "bg-slate-300" },
  dark: { pin: "#52525b", badge: "bg-zinc-100 text-zinc-600 ring-zinc-200", dot: "bg-zinc-500", accent: "bg-zinc-200" },
  orange: { pin: "#f97316", badge: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500", accent: "bg-orange-400" },
  held: { pin: "#059669", badge: "bg-emerald-600 text-white ring-emerald-600", dot: "bg-white", accent: "bg-emerald-600" },
};

/** Icon keys rendered as line icons by components/ui.tsx (never emoji). */
export type IconKey = "queued" | "ringing" | "oncall" | "check" | "x" | "phone" | "callback" | "redirect" | "ban" | "help" | "lock";

export interface AttemptLike {
  purpose: string;
  status: string;
  outcome: string | null;
  needs_review: boolean;
  decline_reason: string | null;
  callback_due_at: string | Date | null;
  alternate_number: string | null;
  answered_at: string | Date | null;
}

export type Group = "accepted" | "in_progress" | "waiting" | "not_available";

export interface Display {
  tone: Tone;
  icon: IconKey;
  text: string;
  group: Group;
}

export function clock(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function readableReason(r: string | null): string {
  if (!r) return "";
  return r.replace(/^(no_bed|no_ventilator|no_specialist|full|not_our_case|other):\s*/i, "").replace(/_/g, " ");
}

export function attemptDisplay(a: AttemptLike, nowMs: number): Display {
  if (a.needs_review) return { tone: "orange", icon: "help", text: "Check the recording", group: "not_available" };
  switch (a.outcome) {
    case "accepted":
      return { tone: "green", icon: "check", text: "Accepted", group: "accepted" };
    case "conditional":
      return { tone: "green-cond", icon: "check", text: "Accepted with a condition", group: "accepted" };
    case "declined":
      return { tone: "red", icon: "x", text: `Declined${a.decline_reason ? ` · ${readableReason(a.decline_reason)}` : ""}`, group: "not_available" };
    case "needs_doctor":
      return { tone: "purple", icon: "phone", text: "Wants to talk to you", group: "waiting" };
    case "callback_later":
      return { tone: "slate", icon: "callback", text: `Calling back at ${clock(a.callback_due_at)}`, group: "waiting" };
    case "redirected":
      return { tone: "slate", icon: "redirect", text: `Redirected${a.alternate_number ? ` to ${a.alternate_number}` : ""}`, group: "waiting" };
    case "ivr_blocked":
      return { tone: "dark", icon: "ban", text: "Phone menu: add a direct number", group: "not_available" };
    case "unclear":
      return { tone: "orange", icon: "help", text: "Check the recording", group: "not_available" };
    case "hold_confirmed":
      return { tone: "held", icon: "lock", text: "Bed held", group: "accepted" };
    case "hold_declined":
      return { tone: "red", icon: "x", text: "Bed no longer available", group: "not_available" };
    case "release_ack":
      return { tone: "grey", icon: "check", text: "Released", group: "not_available" };
  }
  switch (a.status) {
    case "queued":
      return { tone: "grey", icon: "queued", text: "Queued", group: "waiting" };
    case "dialing":
    case "ringing":
      return { tone: "blue", icon: "ringing", text: "Ringing", group: "in_progress" };
    case "in_progress":
    case "wrapping_up": {
      const secs = a.answered_at ? (nowMs - new Date(a.answered_at).getTime()) / 1000 : 0;
      return { tone: "amber", icon: "oncall", text: `On call · ${mmss(secs)}`, group: "in_progress" };
    }
    case "no_answer":
      return { tone: "dark", icon: "ban", text: "No answer", group: "not_available" };
    case "busy":
      return { tone: "dark", icon: "ban", text: "Busy", group: "not_available" };
    case "failed":
      return { tone: "dark", icon: "ban", text: "Call failed", group: "not_available" };
    case "canceled":
      return { tone: "dark", icon: "ban", text: "Cancelled", group: "not_available" };
    default:
      return { tone: "orange", icon: "help", text: "Check the recording", group: "not_available" };
  }
}

export const REFERRAL_STATUS: Record<string, { text: string; tone: Tone; live?: boolean }> = {
  draft: { text: "Draft", tone: "grey" },
  searching: { text: "Calling hospitals", tone: "blue", live: true },
  options_ready: { text: "Options ready", tone: "green" },
  confirming: { text: "Confirming bed", tone: "amber", live: true },
  confirmed: { text: "Bed held", tone: "held" },
  exhausted: { text: "No hospital accepted", tone: "red" },
  cancelled: { text: "Cancelled", tone: "grey" },
  closed: { text: "Closed", tone: "grey" },
};

export function shortName(name: string | null | undefined): string {
  return (name ?? "Hospital").replace(/\s*\(Demo\)\s*/i, "");
}

export interface EventLike {
  type: string;
  payload: Record<string, unknown>;
}

/** Plain-words timeline line for an event, or null to hide it. */
export function eventText(e: EventLike, facilityName: (id: unknown) => string): string | null {
  const p = e.payload ?? {};
  const f = () => facilityName(p.facility_id);
  switch (e.type) {
    case "referral_created":
      return `Referral created${p.simulated ? " (simulated)" : ""}`;
    case "wave_dispatched":
      return `Calling ${(p.facility_ids as unknown[] | undefined)?.length ?? 0} hospitals (round ${p.wave})`;
    case "call_queued":
      return p.purpose === "hold_confirm" ? `Calling ${f()} to confirm the bed` : null;
    case "call_answered":
      return p.purpose === "availability" ? `${f()} answered` : null;
    case "call_ended":
      return p.status === "no_answer" ? `${f()}: no answer` : p.status === "busy" ? `${f()}: busy` : p.status === "failed" ? `${f()}: call failed` : null;
    case "outcome_recorded": {
      const o = String(p.outcome);
      const words: Record<string, string> = {
        accepted: "accepted", conditional: "accepted with a condition", declined: "declined", redirected: "gave another number",
        unclear: "answer unclear", ivr_blocked: "reached a phone menu", needs_doctor: "wants to talk to you", callback_later: "asked for a callback",
      };
      return `${f()} ${words[o] ?? o}${p.source === "manual" ? " (entered by doctor)" : ""}`;
    }
    case "options_ready":
      return `First yes after ${mmss(Number(p.ttfa_seconds ?? 0))}`;
    case "doctor_callback_requested":
      return `${f()} wants to talk to you${p.reason ? `: “${p.reason}”` : ""}`;
    case "inbound_callback":
      return `${p.facility_name ?? "A hospital"} called back${p.message ? `: “${p.message}”` : ""}`;
    case "callback_scheduled":
      return `${f()} asked to be called back at ${clock(p.due_at as string)}`;
    case "redial_dispatched":
      return `Calling ${f()} again (${p.reason})`;
    case "needs_review":
      return `${f()}: answer unclear (call says ${p.function_outcome}, transcript says ${p.extraction_outcome}). Check the recording`;
    case "facility_selected":
      return `You selected ${f()}`;
    case "hold_confirmed":
      return `${f()} confirmed the bed${p.contact_person ? ` · ask for ${p.contact_person}` : ""}${p.manual ? " (confirmed by phone)" : ""}`;
    case "hold_declined":
      return `${f()} can no longer take the patient`;
    case "handoff_sent":
      return `WhatsApp to ${p.audience === "receiving_facility" ? "hospital" : p.audience === "referrer" ? "you" : "family"}: ${p.status}`;
    case "release_dispatched":
      return `Releasing ${f()}`;
    case "hold_expired":
      return "Hold expired";
    case "referral_exhausted":
      return "No hospital accepted";
    case "referral_cancelled":
      return `Referral cancelled${p.reason ? `: ${p.reason}` : ""}`;
    case "referral_closed":
      return `Referral closed: ${String(p.reason).replace(/_/g, " ")}`;
    case "portal_mismatch":
      return `${f()}: desk said ${p.desk_outcome}, but ${p.detail} (${p.source})`;
    case "bed_request_sent":
      return `WhatsApp bed request to ${f()}: ${p.status}`;
    case "family_call_dispatched":
      return p.reason === "missed_call" ? "Family gave a missed call: calling them back with the update" : "Calling the family with the update";
    case "status_recovered":
      return `${f()}: call status recovered from Bolna (missed webhook)`;
    case "alert":
      return String(p.message ?? p.kind);
    default:
      return null;
  }
}
