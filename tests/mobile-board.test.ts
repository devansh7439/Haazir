import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setClock } from "@/lib/core/clock";
import type { Db } from "@/lib/core/db";
import { setDb } from "@/lib/core/db";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { ViewService } from "@/lib/modules/referral/view.service";
import { ReferralViewSchema } from "../mobile/src/api/schema";
import { fakeBolna, KRAIT } from "./support/scripted-calls";
import { fakeClock, freshDb } from "./helpers";

// The phone board shows the stabilise panel and the escalation numbers from the same view the web board reads.

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  setClock(null);
  setDb(null);
  await db.close();
});

const wire = async (id: string) => JSON.parse(JSON.stringify(await ViewService.get(id)));

describe("the phone board's view", () => {
  it("accepts the server's view, nearest emergency departments included, for a critical search in progress", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const parsed = ReferralViewSchema.parse(await wire(referral.id));
    expect(parsed.referral.acuity).toBe("critical");
    expect(parsed.escalation).toEqual([]);
    for (const h of parsed.nearest_ed) expect(h.phone).toMatch(/^\+/);
  });

  it("reads the escalation numbers, and an older server's view without them as none", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const view = await wire(referral.id);
    const withNumbers = ReferralViewSchema.parse({ ...view, escalation: [{ label: "District referral officer", phone: "+919800000777" }] });
    expect(withNumbers.escalation).toEqual([{ label: "District referral officer", phone: "+919800000777" }]);
    const { escalation: _omitted, ...older } = view;
    void _omitted;
    expect(ReferralViewSchema.parse(older).escalation).toEqual([]);
  });
});
