import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { hashDeskToken, looksLikeDeskToken } from "@/lib/modules/hospital/hospital.helper";
import { HospitalService } from "@/lib/modules/hospital/hospital.service";
import { FunctionService } from "@/lib/modules/call/function.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
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

const tokenOf = (url: string) => url.split("/hospital/")[1];

describe("hospital desk link", () => {
  it("opens with the link, keeps only a hash, and stops working when replaced", async () => {
    const { url } = await HospitalService.createLink(DEFAULT_ORG_ID, IDS.tamarind);
    const token = tokenOf(url);
    expect(looksLikeDeskToken(token)).toBe(true);
    expect((await HospitalService.snapshot(token)).facility_name).toContain("Tamarind");
    const stored = await db.query<{ token_hash: string }>(`select token_hash from facility_desk_links where facility_id = $1`, [IDS.tamarind]);
    expect(stored[0].token_hash).toBe(hashDeskToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);

    const second = tokenOf((await HospitalService.createLink(DEFAULT_ORG_ID, IDS.tamarind)).url);
    await expect(HospitalService.snapshot(token)).rejects.toMatchObject({ status: 401 });
    await expect(HospitalService.snapshot(second)).resolves.toBeTruthy();
  });

  it("turns away junk, unknown tokens and a missing token with the same 401", async () => {
    for (const t of ["", "abc", "x".repeat(43), undefined]) {
      await expect(HospitalService.check(t as string)).rejects.toMatchObject({ status: 401 });
    }
  });
});

describe("hospital desk screen", () => {
  it("lists the calls the hospital took, with the case summary and no patient identifier", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const token = tokenOf((await HospitalService.createLink(DEFAULT_ORG_ID, IDS.tamarind)).url);
    const snap = await HospitalService.snapshot(token);
    expect(snap.referrals).toHaveLength(1);
    expect(snap.referrals[0]).toMatchObject({ code: referral.code, state: "asking", can_withdraw: false });
    expect(snap.referrals[0].summary).toContain("snakebite");
    for (const identifier of ["Ramesh", "Lakshmi", "+910000000301"]) expect(JSON.stringify(snap)).not.toContain(identifier);
  });

  it("marks the hospital full: new searches skip it until the time passes, or until it clears the mark", async () => {
    const clock = fakeClock();
    fakeBolna();
    const token = tokenOf((await HospitalService.createLink(DEFAULT_ORG_ID, IDS.tamarind)).url);
    const params = { lat: 13.0707, lng: 77.7982, radius_km: 40, needs: [] as string[], origin_id: IDS.hoskote, org_id: DEFAULT_ORG_ID };
    const ids = async () => (await FacilityRepository.eligible(params)).map((r) => r.id);
    expect(await ids()).toContain(IDS.tamarind);

    const snap = await HospitalService.setFull(token, true, 4);
    expect(snap.full_until).toBe(new Date(clock.now.getTime() + 4 * 3600_000).toISOString());
    expect(await ids()).not.toContain(IDS.tamarind);
    expect(await ids()).toContain(IDS.banyan);

    clock.advance(4 * 3600 + 1);
    expect(await ids()).toContain(IDS.tamarind);
    expect((await HospitalService.snapshot(token)).full_until).toBeNull();

    await HospitalService.setFull(token, true, 2);
    expect((await HospitalService.setFull(token, false)).full_until).toBeNull();
    expect(await ids()).toContain(IDS.tamarind);
  });

  it("lets the chosen hospital tell the doctor it can no longer take the patient, once, without changing the referral", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const [first] = await CallRepository.listForReferral(referral.id);
    const token = tokenOf((await HospitalService.createLink(DEFAULT_ORG_ID, first.facility_id!)).url);
    await FunctionService.recordResponse({ attempt_id: first.id, outcome: "accepted", bed_type: "icu" });
    expect((await HospitalService.snapshot(token)).referrals[0]).toMatchObject({ state: "said_yes", can_withdraw: false });

    await expect(HospitalService.withdraw(token, referral.code)).rejects.toMatchObject({ code: "NOT_CHOSEN" });

    await HoldService.select(referral.id, first.id);
    expect((await HospitalService.snapshot(token)).referrals[0]).toMatchObject({ state: "chosen", can_withdraw: true });
    await HospitalService.withdraw(token, referral.code);
    await HospitalService.withdraw(token, referral.code);
    const alerts = await db.query(`select 1 from events where referral_id = $1 and payload->>'kind' = 'hospital_withdrew'`, [referral.id]);
    expect(alerts).toHaveLength(1);
    expect((await ReferralRepository.get(referral.id))!.status).toBe("confirming");
  });

  it("records treatment started once, only for the hospital the bed is held at", async () => {
    const clock = fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const [first, second] = await CallRepository.listForReferral(referral.id);
    const token = tokenOf((await HospitalService.createLink(DEFAULT_ORG_ID, first.facility_id!)).url);
    const otherToken = tokenOf((await HospitalService.createLink(DEFAULT_ORG_ID, second.facility_id!)).url);
    await FunctionService.recordResponse({ attempt_id: first.id, outcome: "accepted", bed_type: "icu" });
    await HoldService.select(referral.id, first.id);
    await expect(HospitalService.treatmentStarted(token, referral.code)).rejects.toMatchObject({ code: "NOT_HELD" });

    const held = new Date(clock.now.getTime() + 20 * 60_000);
    await ReferralRepository.update(referral.id, { status: "confirmed", confirmed_at: clock.now, hold_expires_at: held }, ["confirming"]);
    expect((await HospitalService.snapshot(token)).referrals[0]).toMatchObject({ state: "held", treatment_started_at: null });
    await expect(HospitalService.treatmentStarted(otherToken, referral.code)).rejects.toMatchObject({ code: "NOT_HELD" });

    clock.advance(600);
    const first1 = (await HospitalService.treatmentStarted(token, referral.code)).referrals[0].treatment_started_at;
    clock.advance(600);
    const first2 = (await HospitalService.treatmentStarted(token, referral.code)).referrals[0].treatment_started_at;
    expect(first1).toBe(new Date(clock.now.getTime() - 600_000).toISOString());
    expect(first2).toBe(first1);
  });
});
