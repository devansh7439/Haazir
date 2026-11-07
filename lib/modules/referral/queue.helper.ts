import type { Acuity } from "@/lib/core/types";
import type { QueueItem } from "@/lib/modules/referral/view.type";

/** What a person has to do next on a live referral. */
export type Attention = "doctor" | "exhausted" | "choose" | "review";

/** Attention first (a desk waiting on the doctor before a recording to check), then how sick, then how long it has waited. */
const ATTENTION_RANK: Record<Attention, number> = { doctor: 0, exhausted: 1, choose: 2, review: 3 };
const ACUITY_RANK: Record<Acuity, number> = { critical: 0, serious: 1, stable: 2 };

/** The calls are still going, so a desk's request or an unclear answer can still be acted on. */
const CALLING = ["searching", "options_ready"];

type AttentionFacts = Pick<QueueItem, "status" | "needs_doctor" | "needs_review">;

/** The one thing a person must do next for this referral, or null when Haazir is still working and nothing is needed. */
export function attentionOf(r: AttentionFacts): Attention | null {
  if (CALLING.includes(r.status) && r.needs_doctor > 0) return "doctor";
  if (r.status === "exhausted") return "exhausted";
  if (r.status === "options_ready") return "choose";
  if (CALLING.includes(r.status) && r.needs_review > 0) return "review";
  return null;
}

/** The queue in the order a coordinator should work it. Does not change `rows`. */
export function sortQueue<T extends AttentionFacts & Pick<QueueItem, "acuity" | "created_at">>(rows: T[]): T[] {
  const rank = (r: T) => {
    const a = attentionOf(r);
    return a === null ? 99 : ATTENTION_RANK[a];
  };
  return [...rows].sort(
    (a, b) => rank(a) - rank(b) || ACUITY_RANK[a.acuity] - ACUITY_RANK[b.acuity] || Date.parse(a.created_at) - Date.parse(b.created_at),
  );
}

/** The sentence that tells the coordinator what to do, for the queue row. */
export function attentionText(a: Attention, r: Pick<QueueItem, "calls_accepted" | "needs_doctor" | "needs_review">): string {
  switch (a) {
    case "doctor":
      return r.needs_doctor === 1 ? "A desk wants to talk to the doctor" : `${r.needs_doctor} desks want to talk to the doctor`;
    case "exhausted":
      return "Nobody said yes: widen the search or call a hospital";
    case "choose":
      return r.calls_accepted === 1 ? "1 hospital said yes: choose" : `${r.calls_accepted} hospitals said yes: choose one`;
    case "review":
      return "Check a recording before choosing";
  }
}
