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

export const TONE: Record<Tone, { pin: string; card: string; badge: string }> = {
  grey: { pin: "#9ca3af", card: "border-gray-300", badge: "bg-gray-100 text-gray-800" },
  blue: { pin: "#2563eb", card: "border-blue-400", badge: "bg-blue-100 text-blue-900" },
  amber: { pin: "#d97706", card: "border-amber-400", badge: "bg-amber-100 text-amber-900" },
  green: { pin: "#16a34a", card: "border-green-600", badge: "bg-green-100 text-green-900" },
  "green-cond": { pin: "#16a34a", card: "border-amber-500 border-2", badge: "bg-green-100 text-green-900" },
  red: { pin: "#dc2626", card: "border-red-400", badge: "bg-red-100 text-red-900" },
  purple: { pin: "#7c3aed", card: "border-violet-500", badge: "bg-violet-100 text-violet-900" },
  slate: { pin: "#64748b", card: "border-slate-400", badge: "bg-slate-100 text-slate-800" },
  dark: { pin: "#374151", card: "border-gray-400", badge: "bg-gray-200 text-gray-800" },
  orange: { pin: "#ea580c", card: "border-orange-500 border-2", badge: "bg-orange-100 text-orange-900" },
  held: { pin: "#15803d", card: "border-green-700 border-2", badge: "bg-green-700 text-white" },
};

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
  icon: string;
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
  if (a.needs_review) return { tone: "orange", icon: "?", text: "Check the recording", group: "not_available" };
  switch (a.outcome) {
    case "accepted":
      return { tone: "green", icon: "✔", text: "Accepted", group: "accepted" };
    case "conditional":
      return { tone: "green-cond", icon: "✔", text: "Accepted with a condition", group: "accepted" };
    case "declined":
      return { tone: "red", icon: "✖", text: `Declined${a.decline_reason ? ` · ${readableReason(a.decline_reason)}` : ""}`, group: "not_available" };
    case "needs_doctor":
      return { tone: "purple", icon: "☎", text: "Wants to talk to you", group: "waiting" };
    case "callback_later":
      return { tone: "slate", icon: "↻", text: `Calling back at ${clock(a.callback_due_at)}`, group: "waiting" };
    case "redirected":
      return { tone: "slate", icon: "↪", text: `Redirected${a.alternate_number ? ` to ${a.alternate_number}` : ""}`, group: "waiting" };
    case "ivr_blocked":
      return { tone: "dark", icon: "⊘", text: "Phone menu: add a direct number", group: "not_available" };
    case "unclear":
      return { tone: "orange", icon: "?", text: "Check the recording", group: "not_available" };
    case "hold_confirmed":
      return { tone: "held", icon: "🔒", text: "Bed held", group: "accepted" };
    case "hold_declined":
      return { tone: "red", icon: "✖", text: "Bed no longer available", group: "not_available" };
    case "release_ack":
      return { tone: "grey", icon: "✓", text: "Released", group: "not_available" };
  }
  switch (a.status) {
    case "queued":
      return { tone: "grey", icon: "○", text: "Queued", group: "waiting" };
    case "dialing":
    case "ringing":
      return { tone: "blue", icon: "☎", text: "Ringing", group: "in_progress" };
    case "in_progress":
    case "wrapping_up": {
      const secs = a.answered_at ? (nowMs - new Date(a.answered_at).getTime()) / 1000 : 0;
      return { tone: "amber", icon: "◐", text: `On call · ${mmss(secs)}`, group: "in_progress" };
    }
    case "no_answer":
      return { tone: "dark", icon: "⊘", text: "No answer", group: "not_available" };
    case "busy":
      return { tone: "dark", icon: "⊘", text: "Busy", group: "not_available" };
    case "failed":
      return { tone: "dark", icon: "⊘", text: "Call failed", group: "not_available" };
    case "canceled":
      return { tone: "dark", icon: "⊘", text: "Cancelled", group: "not_available" };
    default:
      return { tone: "orange", icon: "?", text: "Check the recording", group: "not_available" };
  }
}

export const REFERRAL_STATUS: Record<string, { text: string; className: string }> = {
  draft: { text: "Draft", className: "bg-gray-100 text-gray-800" },
  searching: { text: "Calling hospitals", className: "bg-blue-100 text-blue-900" },
  options_ready: { text: "Options ready", className: "bg-green-100 text-green-900" },
  confirming: { text: "Confirming bed", className: "bg-amber-100 text-amber-900" },
  confirmed: { text: "Bed held", className: "bg-green-700 text-white" },
  exhausted: { text: "No hospital accepted", className: "bg-red-100 text-red-900" },
  cancelled: { text: "Cancelled", className: "bg-gray-200 text-gray-800" },
  closed: { text: "Closed", className: "bg-gray-200 text-gray-800" },
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
    case "alert":
      return `⚠ ${p.message ?? p.kind}`;
    default:
      return null;
  }
}
