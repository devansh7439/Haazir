import { describe, expect, it } from "vitest";
import { canTransition, mapBolnaStatus } from "@/lib/modules/call/status.helper";
import type { AttemptStatus } from "@/lib/core/types";

/** Applies webhooks in the given order with the monotonic rule, like the webhook handler does. */
function replay(statuses: string[]): AttemptStatus {
  let s: AttemptStatus = "queued";
  for (const raw of statuses) {
    const m = mapBolnaStatus(raw);
    if (m && canTransition(s, m.status)) s = m.status;
  }
  return s;
}

describe("status map", () => {
  it("maps Bolna statuses", () => {
    expect(mapBolnaStatus("in-progress")?.status).toBe("in_progress");
    expect(mapBolnaStatus("call-disconnected")?.status).toBe("wrapping_up");
    expect(mapBolnaStatus("stopped")?.status).toBe("canceled");
    expect(mapBolnaStatus("balance-low")).toEqual({ status: "failed", alert: "balance_low" });
    expect(mapBolnaStatus("rescheduled")).toEqual({ status: "queued", alert: "guardrails_rescheduled" });
    expect(mapBolnaStatus("something-new")).toBeNull();
  });

  it("never moves backwards on out-of-order webhooks", () => {
    expect(replay(["in-progress", "ringing", "initiated"])).toBe("in_progress");
    expect(replay(["completed", "in-progress", "call-disconnected"])).toBe("completed");
  });

  it("ignores duplicates", () => {
    expect(canTransition("ringing", "ringing")).toBe(false);
    expect(replay(["ringing", "ringing", "in-progress", "in-progress"])).toBe("in_progress");
  });

  it("allows only completed (or failed) after call-disconnected", () => {
    expect(canTransition("wrapping_up", "completed")).toBe(true);
    expect(canTransition("wrapping_up", "no_answer")).toBe(false);
    expect(canTransition("completed", "failed")).toBe(false);
    expect(canTransition("no_answer", "completed")).toBe(false);
  });
});
