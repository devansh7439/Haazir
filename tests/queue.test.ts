import { describe, expect, it } from "vitest";
import { attentionOf, attentionText, sortQueue } from "@/lib/modules/referral/queue.helper";
import type { QueueItem } from "@/lib/modules/referral/view.type";

const item = (o: Partial<QueueItem> = {}): QueueItem => ({
  id: "r1", code: "R-1000", status: "searching", case_label: "Snakebite", acuity: "critical", created_at: "2026-11-07T10:00:00.000Z",
  referrer_name: "Dr. Rao", entered_by_name: null, calls_open: 6, calls_answered: 0, calls_accepted: 0, needs_doctor: 0, needs_review: 0,
  ttfa_seconds: null, ...o,
});

describe("what needs a person on the queue", () => {
  it("is nothing while the calls are simply going", () => {
    expect(attentionOf(item())).toBeNull();
    expect(attentionOf(item({ status: "confirmed" }))).toBeNull();
    expect(attentionOf(item({ status: "confirming" }))).toBeNull();
  });

  it("is a decision once a hospital has said yes, and a callback before anything else", () => {
    expect(attentionOf(item({ status: "options_ready", calls_accepted: 2 }))).toBe("choose");
    expect(attentionOf(item({ status: "options_ready", calls_accepted: 2, needs_doctor: 1 }))).toBe("doctor");
  });

  it("is the doctor's callback while the search is still on, and a recording to check", () => {
    expect(attentionOf(item({ needs_doctor: 1 }))).toBe("doctor");
    expect(attentionOf(item({ needs_review: 1 }))).toBe("review");
  });

  it("is a widened search or a call when nobody said yes", () => {
    expect(attentionOf(item({ status: "exhausted" }))).toBe("exhausted");
  });

  it("ignores a desk's old request once a bed is chosen", () => {
    expect(attentionOf(item({ status: "confirming", needs_doctor: 1, needs_review: 1 }))).toBeNull();
    expect(attentionOf(item({ status: "confirmed", needs_doctor: 1 }))).toBeNull();
  });
});

describe("queue order", () => {
  it("puts what needs a person first: a waiting desk, then no answer, then a choice, then a recording", () => {
    const rows = [
      item({ id: "calling" }),
      item({ id: "review", needs_review: 1 }),
      item({ id: "choose", status: "options_ready" }),
      item({ id: "exhausted", status: "exhausted" }),
      item({ id: "doctor", needs_doctor: 1 }),
    ];
    expect(sortQueue(rows).map((r) => r.id)).toEqual(["doctor", "exhausted", "choose", "review", "calling"]);
  });

  it("puts the sicker patient first, then the one who has waited longest", () => {
    const rows = [
      item({ id: "stable-old", acuity: "stable", created_at: "2026-11-07T09:00:00.000Z" }),
      item({ id: "critical-new", created_at: "2026-11-07T10:05:00.000Z" }),
      item({ id: "critical-old", created_at: "2026-11-07T10:00:00.000Z" }),
      item({ id: "serious", acuity: "serious" }),
    ];
    expect(sortQueue(rows).map((r) => r.id)).toEqual(["critical-old", "critical-new", "serious", "stable-old"]);
  });

  it("does not change the list it was given", () => {
    const rows = [item({ id: "b", acuity: "stable" }), item({ id: "a" })];
    sortQueue(rows);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("what the queue tells the coordinator to do", () => {
  it("counts the yeses and the desks", () => {
    expect(attentionText("choose", item({ calls_accepted: 1 }))).toBe("1 hospital said yes: choose");
    expect(attentionText("choose", item({ calls_accepted: 3 }))).toBe("3 hospitals said yes: choose one");
    expect(attentionText("doctor", item({ needs_doctor: 1 }))).toBe("A desk wants to talk to the doctor");
    expect(attentionText("doctor", item({ needs_doctor: 2 }))).toBe("2 desks want to talk to the doctor");
  });
});
