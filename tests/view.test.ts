import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/core/types";
import { alertsOf, messagesOf, portalFlagsOf, withoutFamilyContent } from "@/lib/modules/referral/view.helper";
import type { AttemptView } from "@/lib/modules/referral/view.type";

// The browser view's pure shaping: what the doctor is asked to act on, and what never reaches the browser.

let id = 0;
const event = (type: string, payload: Record<string, unknown>, attemptId: string | null = null): EventRow =>
  ({ id: ++id, referral_id: "r1", attempt_id: attemptId, type, payload, created_at: "2026-10-31T10:00:00Z" }) as EventRow;
const attempt = (o: Partial<AttemptView>): AttemptView => ({ id: "a1", purpose: "availability", outcome: null, ...o }) as AttemptView;

describe("view helpers", () => {
  it("never shows a family call's transcript, recording or extraction", () => {
    const family = attempt({ id: "a2", purpose: "family_update", transcript: "Hello Lakshmi", recording_url: "https://x", extracted_data: { a: 1 } });
    const [shown] = withoutFamilyContent([family]);
    expect([shown.transcript, shown.recording_url, shown.extracted_data]).toEqual([null, null, null]);
    expect(family.transcript).toBe("Hello Lakshmi");
  });

  it("drops dismissed alerts and doctor requests the desk has since answered", () => {
    const asked = event("doctor_callback_requested", { facility_name: "Banyan", number: "+911", reason: "talk to doctor" }, "a1");
    const failed = event("alert", { kind: "call_failed", message: "Call failed" });
    const dismissed = event("alert_dismissed", { event_id: failed.id });
    expect(alertsOf([asked, failed, dismissed], [attempt({ outcome: "needs_doctor" })]).map((a) => a.event_id)).toEqual([asked.id]);
    expect(alertsOf([asked], [attempt({ outcome: "accepted" })])).toEqual([]);
    expect(alertsOf([failed], [])[0]).toMatchObject({ kind: "call_failed", reason: "Call failed", facility_name: null });
  });

  it("shows messages and portal flags from their redacted events only", () => {
    const sent = event("handoff_sent", { audience: "family", to_masked: "+91••••• ••45", status: "simulated", preview_redacted: "Bed confirmed" });
    expect(messagesOf([sent])).toEqual([{ audience: "family", to_masked: "+91••••• ••45", status: "simulated", preview_redacted: "Bed confirmed", created_at: "2026-10-31T10:00:00.000Z" }]);
    const flag = event("portal_mismatch", { detail: "portal shows 3 ICU beds free", source: "state portal", observed_at: "2026-10-31T09:00:00Z" }, "a1");
    expect(portalFlagsOf([flag, event("portal_mismatch", { detail: "x" })])).toEqual({ a1: { detail: "portal shows 3 ICU beds free", source: "state portal", observed_at: "2026-10-31T09:00:00Z" } });
  });
});
