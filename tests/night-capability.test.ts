import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { availabilityUserData } from "@/lib/modules/call/user-data.helper";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { FacilityService } from "@/lib/modules/facility/facility.service";
import { isNight, scoreFacility, type EligibleRow } from "@/lib/modules/facility/matching.helper";
import { IDS, fakeClock, freshDb } from "./helpers";

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

// 2026-01-01 in India (UTC+5:30): 02:30 and 12:30 local.
const AT_NIGHT = new Date("2025-12-31T21:00:00Z");
const AT_NOON = new Date("2026-01-01T07:00:00Z");

const row = (day_only_needs: string[]): EligibleRow => ({
  id: "f", name: "f", lat: 0, lng: 0, distance_km: 5, eta_minutes: 20, call_language: "en", availability_calls: 0, answered: 0, accepted: 0, day_only_needs,
});

describe("night", () => {
  it("is 8pm to 8am in India", () => {
    expect(isNight(AT_NIGHT)).toBe(true);
    expect(isNight(AT_NOON)).toBe(false);
    expect(isNight(new Date("2026-01-01T14:29:00Z"))).toBe(false); // 19:59
    expect(isNight(new Date("2026-01-01T14:30:00Z"))).toBe(true); // 20:00
    expect(isNight(new Date("2026-01-01T02:29:00Z"))).toBe(true); // 07:59
    expect(isNight(new Date("2026-01-01T02:30:00Z"))).toBe(false); // 08:00
  });

  it("ranks a hospital with a day-only need lower at night, and not by day", () => {
    expect(scoreFacility(row(["ventilator"]), null, true)).toBeLessThan(scoreFacility(row([]), null, true));
    expect(scoreFacility(row(["ventilator"]), null, false)).toBe(scoreFacility(row([]), null, false));
  });
});

describe("day-only capabilities", () => {
  const params = { lat: 13.0707, lng: 77.7982, radius_km: 40, needs: ["ventilator"], origin_id: IDS.hoskote, org_id: DEFAULT_ORG_ID };

  it("are saved from the admin list, reported in the directory, and found by matching without skipping the hospital", async () => {
    fakeClock();
    const [first] = await FacilityRepository.eligible(params);
    const codes = (await db.query<{ capability_code: string }>(`select capability_code from facility_capabilities where facility_id = $1`, [first.id])).map((c) => c.capability_code);
    await DirectoryService.setCapabilities(first.id, codes, ["ventilator"]);

    const listed = (await DirectoryService.list(DEFAULT_ORG_ID)).find((f) => f.id === first.id)!;
    expect(listed.day_only).toEqual(["ventilator"]);
    const after = await FacilityRepository.eligible(params);
    expect(after.find((r) => r.id === first.id)!.day_only_needs).toEqual(["ventilator"]);
    expect(after.map((r) => r.id)).toContain(first.id);
    expect(await FacilityRepository.dayOnlyNeeds(first.id, ["ventilator", "icu_bed"])).toEqual(["ventilator"]);

    // Saving without the list leaves each flag as it was; clearing it makes the service available at night again.
    await DirectoryService.setCapabilities(first.id, codes);
    expect((await FacilityRepository.dayOnlyNeeds(first.id, ["ventilator"]))).toEqual(["ventilator"]);
    await DirectoryService.setCapabilities(first.id, codes, []);
    expect(await FacilityRepository.dayOnlyNeeds(first.id, ["ventilator"])).toEqual([]);
  });

  it("push the hospital down the night ranking but leave it in", async () => {
    const clock = fakeClock(AT_NIGHT);
    const day = await FacilityService.rankEligible(params, ["a ventilator"]);
    const flagged = day[0];
    const codes = (await db.query<{ capability_code: string }>(`select capability_code from facility_capabilities where facility_id = $1`, [flagged.facility_id])).map((c) => c.capability_code);
    await DirectoryService.setCapabilities(flagged.facility_id, codes, ["ventilator"]);

    const night = await FacilityService.rankEligible(params, ["a ventilator"]);
    expect(night.map((f) => f.facility_id)).toContain(flagged.facility_id);
    expect(night.find((f) => f.facility_id === flagged.facility_id)!.score).toBeLessThan(flagged.score);
    expect(night.find((f) => f.facility_id === flagged.facility_id)!.rank_reasons.join(" ")).toContain("day-only");

    clock.advance(10 * 3600); // midday
    const noon = await FacilityService.rankEligible(params, ["a ventilator"]);
    expect(noon.find((f) => f.facility_id === flagged.facility_id)!.score).toBe(flagged.score);
  });
});

describe("the call's night note", () => {
  const ctx = { attempt_id: "a", doctor_name: "Dr Rao", referring_facility: "Hoskote PHC", facility_name: "Tamarind", referral_code: "R-1", language: "en" };
  const c = { case_summary: "Man aged 34.", needs_spoken: "a ventilator", eta_minutes: 18 };

  it("is always sent, empty unless a day-only need was found", () => {
    expect(availabilityUserData(ctx, c).night_note).toBe("");
    expect(availabilityUserData(ctx, { ...c, night_note: "It is night, and this hospital usually has a ventilator only in the daytime." }).night_note).toContain("ventilator");
  });
});
