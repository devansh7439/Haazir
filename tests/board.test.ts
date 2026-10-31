import { describe, expect, it } from "vitest";
import type { EventRow, Referral } from "@/lib/core/types";
import type { AttemptView, ReferralView } from "@/lib/modules/referral/view.type";
import { cardsOf, groupCards, holdState, isIdle, isLive, nextReferralId, pinsOf, searchTimes } from "@/lib/ui/board";

// The live board's shaping, without a browser.

const T0 = "2026-10-31T10:00:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();
const attempt = (o: Partial<AttemptView>): AttemptView =>
  ({ id: "a1", purpose: "availability", facility_id: "f1", status: "ringing", outcome: null, needs_review: false, eta_minutes: 18, rank: 1,
     facility_name: "Tamarind (Demo)", facility_lat: 13, facility_lng: 77, answered_at: null, callback_due_at: null, alternate_number: null,
     decline_reason: null, ...o }) as AttemptView;
const referral = (o: Partial<Referral>): Referral => ({ id: "r1", status: "searching", created_at: T0, confirmed_at: null, closed_at: null, first_acceptance_at: null, selected_facility_id: null, ...o }) as Referral;
const view = (r: Partial<Referral>, attempts: AttemptView[], events: EventRow[] = []): ReferralView => ({ referral: referral(r), attempts, events }) as ReferralView;
const event = (type: string, created_at: string, payload: Record<string, unknown> = {}) => ({ id: 1, referral_id: "r1", attempt_id: null, type, payload, created_at }) as EventRow;

describe("board shaping", () => {
  it("shows one card per hospital: its latest call, with the call count", () => {
    const first = attempt({ id: "a1", status: "busy" });
    const redial = attempt({ id: "a2", status: "ringing" });
    const other = attempt({ id: "a3", facility_id: "f2" });
    const hold = attempt({ id: "a4", purpose: "hold_confirm" });
    expect(cardsOf([first, redial, other, hold]).map((c) => [c.a.id, c.calls])).toEqual([["a2", 2], ["a3", 1]]);
  });

  it("groups accepted first and sorts each group by drive time", () => {
    const far = attempt({ id: "far", facility_id: "f2", outcome: "accepted", eta_minutes: 40 });
    const near = attempt({ id: "near", facility_id: "f3", outcome: "accepted", eta_minutes: 20 });
    const ringing = attempt({ id: "ring", facility_id: "f4" });
    const groups = groupCards(cardsOf([ringing, far, near]), Date.parse(T0));
    expect(groups.map((g) => [g.g, g.items.map((c) => c.a.id)])).toEqual([["accepted", ["near", "far"]], ["in_progress", ["ring"]]]);
  });

  it("builds pins without the running call timer, so the map doesn't redraw every second", () => {
    const onCall = attempt({ status: "in_progress", answered_at: T0 });
    const [pin] = pinsOf(cardsOf([onCall]), null, "searching");
    expect(pin).toMatchObject({ label: "1", title: "Tamarind", live: true });
    expect(pin.detail).toBe("18 min · On call");
    expect(pinsOf(cardsOf([attempt({ facility_lat: null })]), null, "searching")).toEqual([]);
  });

  it("stops the timer when the search ends and reports the time to first yes", () => {
    expect(searchTimes(referral({}), [], Date.parse(at(75)))).toEqual({ elapsed: 75, ttfa: null });
    const confirmed = referral({ status: "confirmed", confirmed_at: at(140), first_acceptance_at: at(35) });
    expect(searchTimes(confirmed, [], Date.parse(at(900)))).toEqual({ elapsed: 140, ttfa: 35 });
    const exhausted = referral({ status: "exhausted" });
    expect(searchTimes(exhausted, [event("referral_exhausted", at(300))], Date.parse(at(900))).elapsed).toBe(300);
  });

  it("knows when to tick, when to slow down, and where a widened search went", () => {
    expect(isLive(view({ status: "closed" }, []))).toBe(false);
    expect(isLive(view({ status: "cancelled" }, [attempt({ status: "in_progress" })]))).toBe(true);
    expect(isLive(view({ status: "cancelled" }, [attempt({ status: "completed" })]))).toBe(false);
    expect(isIdle(view({ status: "confirmed" }, [attempt({ status: "completed" })]))).toBe(true);
    expect(nextReferralId([event("referral_closed", T0, { reason: "arrived" }), event("referral_closed", T0, { next_referral_id: "r2" })])).toBe("r2");
    expect(nextReferralId([event("referral_closed", T0, { next_referral_id: 7 })])).toBeNull();
    const hold = attempt({ id: "h2", purpose: "hold_confirm" });
    expect(holdState(view({}, [attempt({ id: "h1", purpose: "hold_confirm" }), hold], [event("hold_expired", T0)]))).toMatchObject({ hold, expired: true });
  });
});

describe("map pins", () => {
  it("labels hospitals still in play with their drive time and leaves out the ones that are out", () => {
    const yes = attempt({ id: "y", facility_id: "f2", outcome: "accepted", eta_minutes: 35 });
    const no = attempt({ id: "n", facility_id: "f3", outcome: "declined", eta_minutes: 37 });
    const ringing = attempt({ id: "r", facility_id: "f4", eta_minutes: 46 });
    const pins = pinsOf(cardsOf([yes, no, ringing]), null, "options_ready");
    expect(pins.map((p) => [p.id, p.role, p.eta])).toEqual([["y", "accepted", "35 min"], ["n", "out", null], ["r", "pending", "46 min"]]);
  });

  it("marks the chosen hospital as selected while the hold is confirming and once it is held", () => {
    const chosen = attempt({ id: "y", facility_id: "f2", outcome: "accepted" });
    for (const status of ["confirming", "confirmed"] as const) {
      expect(pinsOf(cardsOf([chosen]), "f2", status)[0].role).toBe("selected");
    }
    expect(pinsOf(cardsOf([chosen]), "f2", "options_ready")[0].role).toBe("accepted");
  });
});
