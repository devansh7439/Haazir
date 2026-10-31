import { describe, expect, it } from "vitest";
import { BOLNA_STATUSES, makeCall, toBolnaStatus } from "@/lib/integrations/bolna/bolna.client";
import { mapBolnaStatus } from "@/lib/modules/call/status.helper";

describe("Bolna statuses", () => {
  it("knows the documented ones and nothing else", () => {
    expect(toBolnaStatus("in-progress")).toBe("in-progress");
    expect(toBolnaStatus("made-up")).toBeNull();
    expect(toBolnaStatus(42)).toBeNull();
    expect(toBolnaStatus(undefined)).toBeNull();
  });

  it("maps every documented status to ours, so a new one in the list can't be forgotten", () => {
    for (const s of BOLNA_STATUSES) expect(mapBolnaStatus(s), s).not.toBeUndefined();
    expect(mapBolnaStatus("stopped")?.status).toBe("canceled");
    expect(mapBolnaStatus("made-up")).toBeNull();
  });

  it("a simulated call never reaches Bolna and comes back queued", async () => {
    const res = await makeCall(
      { agent_id: "", recipient_phone_number: "+910000000000", user_data: {}, agent_data: { language: "en" }, bypass_call_guardrails: true },
      { simulate: true },
    );
    expect(res.status).toBe("queued");
    expect(res.execution_id.startsWith("sim_")).toBe(true);
  });
});
