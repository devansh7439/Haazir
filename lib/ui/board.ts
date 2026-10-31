import type { AttemptStatus, EventRow, Referral, ReferralStatus } from "@/lib/core/types";
import type { AttemptView, ReferralView } from "@/lib/modules/referral/view.type";
import { TONE, attemptDisplay, shortName, type Group } from "@/lib/ui/display";

// Client-safe shaping for the live board: pure functions of the referral view and the clock.

/** A hospital on the board: its latest availability call, and how many calls it has had. */
export interface Card {
  a: AttemptView;
  calls: number;
}

/** A hospital pin on the live map. */
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  live?: boolean;
  title: string;
  detail: string;
}

export const GROUP_TITLE: Record<Group, string> = {
  accepted: "Accepted",
  in_progress: "On the line",
  waiting: "Waiting",
  not_available: "Not available",
};
export const GROUP_ORDER: Group[] = ["accepted", "in_progress", "waiting", "not_available"];

const TERMINAL: AttemptStatus[] = ["completed", "no_answer", "busy", "failed", "canceled"];
const CANCELLABLE: ReferralStatus[] = ["searching", "options_ready", "exhausted", "confirming"];

/** Whether a call has ended (answered or not). */
export const callEnded = (status: AttemptStatus): boolean => TERMINAL.includes(status);

/** A status text without its running "· 1:05" timer. */
export const withoutTimer = (text: string): string => text.replace(/ · \d+:\d+$/, "");

/** Whether the board should keep ticking: anything but closed, and cancelled only while a call is still live. */
export const isLive = (view: ReferralView): boolean => {
  const s = view.referral.status;
  return s !== "closed" && (s !== "cancelled" || view.attempts.some((a) => !callEnded(a.status)));
};

/** Bed held and every call finished: only the hold-expiry check is left, so the board can tick slowly. */
export const isIdle = (view: ReferralView): boolean =>
  view.referral.status === "confirmed" && view.attempts.every((a) => callEnded(a.status));

export const isCancellable = (status: ReferralStatus): boolean => CANCELLABLE.includes(status);

/** One card per hospital: its latest availability call (redials and callbacks replace earlier ones). */
export const cardsOf = (attempts: AttemptView[]): Card[] => {
  const latest = new Map<string, AttemptView>();
  const counts = new Map<string, number>();
  for (const a of attempts.filter((x) => x.purpose === "availability")) {
    const key = a.facility_id ?? a.id;
    latest.set(key, a);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...latest.entries()].map(([key, a]) => ({ a, calls: counts.get(key) ?? 1 }));
};

/** The cards by group, nearest first within each; empty groups are left out. */
export const groupCards = (cards: Card[], nowMs: number): Array<{ g: Group; items: Card[] }> =>
  GROUP_ORDER.map((g) => ({
    g,
    items: cards
      .filter(({ a }) => attemptDisplay(a, nowMs).group === g)
      .sort((x, y) => (x.a.eta_minutes ?? 999) - (y.a.eta_minutes ?? 999)),
  })).filter((x) => x.items.length > 0);

/**
 * Map pins. They don't depend on the clock (the on-call timer is left out of the tooltip), so the map only
 * re-renders when the data changes.
 */
export const pinsOf = (cards: Card[], selectedFacilityId: string | null, status: ReferralStatus): MapPin[] =>
  cards
    .filter(({ a }) => a.facility_lat !== null && a.facility_lng !== null)
    .map(({ a }) => {
      const d = attemptDisplay(a, 0);
      const held = selectedFacilityId === a.facility_id && status === "confirmed";
      return {
        id: a.id,
        lat: a.facility_lat!,
        lng: a.facility_lng!,
        label: String(a.rank ?? "•"),
        color: held ? TONE.held.pin : TONE[d.tone].pin,
        live: d.tone === "amber",
        title: shortName(a.facility_name),
        detail: `${a.eta_minutes ?? "?"} min · ${held ? "Bed held" : withoutTimer(d.text)}`,
      };
    });

const seconds = (from: Date | string, to: Date | string | number): number => (new Date(to).getTime() - new Date(from).getTime()) / 1000;

/**
 * The header timers: time since the referral started, stopped when the search ends (bed confirmed, closed,
 * cancelled or nobody accepted), and the time to first acceptance (null until someone says yes).
 */
export const searchTimes = (r: Referral, events: EventRow[], nowMs: number): { elapsed: number; ttfa: number | null } => {
  const endEvent = events.find((e) => e.type === "referral_cancelled" || e.type === "referral_exhausted");
  const endAt = r.confirmed_at ?? r.closed_at ?? (["cancelled", "exhausted"].includes(r.status) ? endEvent?.created_at ?? null : null);
  return {
    elapsed: endAt ? seconds(r.created_at, endAt) : seconds(r.created_at, nowMs),
    ttfa: r.first_acceptance_at ? seconds(r.created_at, r.first_acceptance_at) : null,
  };
};

/** The latest hold call, the release calls, and whether the hold has expired. */
export const holdState = (view: ReferralView): { hold: AttemptView | null; releases: AttemptView[]; expired: boolean } => {
  const holds = view.attempts.filter((a) => a.purpose === "hold_confirm");
  return {
    hold: holds[holds.length - 1] ?? null,
    releases: view.attempts.filter((a) => a.purpose === "release"),
    expired: view.events.some((e) => e.type === "hold_expired"),
  };
};

/** The referral a widened search continues in, or null. */
export const nextReferralId = (events: EventRow[]): string | null => {
  for (const e of events) {
    if (e.type !== "referral_closed") continue;
    const id = e.payload && typeof e.payload === "object" ? (e.payload as Record<string, unknown>).next_referral_id : undefined;
    if (typeof id === "string" && id) return id;
  }
  return null;
};
