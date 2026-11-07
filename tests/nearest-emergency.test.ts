import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { ViewService } from "@/lib/modules/referral/view.service";
import { KRAIT, fakeBolna } from "./support/scripted-calls";
import { IDS, fakeClock, freshDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

const HOSKOTE = { lat: 13.0707, lng: 77.7982, org_id: DEFAULT_ORG_ID, origin_id: IDS.hoskote };

describe("nearest emergency departments", () => {
  it("lists the closest hospitals with a direct casualty desk, nearest first", async () => {
    const near = await FacilityRepository.nearestEmergency(HOSKOTE);
    expect(near.map((h) => h.name.replace(/ \(Demo\)$/, "").split(" ")[0])).toEqual(["Tamarind", "Banyan", "Neem"]);
    // Banyan's reception line is an IVR; its casualty desk is the number given.
    expect(near.map((h) => h.phone)).toEqual(["+910000000103", "+910000000101", "+910000000102"]);
    expect(near[0].distance_km).toBeLessThan(near[1].distance_km);
    expect(near.every((h) => h.eta_minutes > 0)).toBe(true);
  });

  it("leaves out the origin, a nursing home, and a hospital with no casualty desk number", async () => {
    const all = await FacilityRepository.nearestEmergency({ ...HOSKOTE, limit: 20 });
    const ids = all.map((h) => h.facility_id);
    expect(ids).not.toContain(IDS.hoskote); // the referring PHC
    expect(ids).not.toContain(IDS.mango); // referral desk only
    expect(ids).not.toContain("00000000-0000-4000-8000-000000000108"); // Sandal Nursing Home
    expect(ids).toContain("00000000-0000-4000-8000-000000000107"); // Peepal, a hospital with a casualty desk
  });

  it("is in the board view when nobody accepted", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create({ ...KRAIT, acuity: "serious" });
    expect((await ViewService.get(referral.id))!.nearest_ed).toEqual([]);
    await ReferralRepository.update(referral.id, { status: "exhausted" }, ["searching"]);
    const view = (await ViewService.get(referral.id))!;
    expect(view.nearest_ed).toHaveLength(3);
    expect(view.nearest_ed[0]).toMatchObject({ phone: "+910000000103" });
  });

  it("is also there for a critical patient while the search runs, and not once a bed is held", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    expect((await ViewService.get(referral.id))!.nearest_ed).toHaveLength(3);
    await ReferralRepository.update(referral.id, { status: "confirmed" }, ["searching"]);
    expect((await ViewService.get(referral.id))!.nearest_ed).toEqual([]);
  });
});
