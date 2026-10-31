import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setClock } from "@/lib/core/clock";
import type { Db } from "@/lib/core/db";
import { setDb } from "@/lib/core/db";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { advanceSimulation, scenario } from "@/lib/modules/demo/simulator.service";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { HoldService } from "@/lib/modules/referral/hold.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { IDS, fakeClock, freshDb } from "./helpers";

// docs/09 §3: the family is messaged and called only when the doctor recorded that the attendant agreed.

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  vi.stubEnv("FAMILY_CALLS", "on");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

/** Runs the krait-bite story to a confirmed bed, with or without the attendant's consent. */
async function confirmed(consent: boolean | undefined) {
  const clock = fakeClock();
  const input = structuredClone(scenario.referral);
  input.patient = { ...input.patient!, attendant_consent: consent };
  const { referral } = await ReferralService.create(input, { simulate: true });
  let selected = false;
  for (let t = 0; t <= 240; t++) {
    await advanceSimulation(referral.id);
    await EvaluationService.evaluate(referral.id);
    const r = await ReferralRepository.get(referral.id);
    if (!selected && r!.status === "options_ready" && t >= 45) {
      const a = (await CallRepository.listForReferral(referral.id)).find((x) => x.facility_id === IDS.tamarind && x.purpose === "availability")!;
      await HoldService.select(referral.id, a.id);
      selected = true;
    }
    clock.advance(1);
  }
  return referral.id;
}

const audiences = async (id: string) =>
  (await db.query<{ audience: string }>(`select audience from messages where referral_id = $1 order by audience`, [id])).map((m) => m.audience);

describe("attendant consent", () => {
  it("messages and calls the family when consent was recorded", async () => {
    const id = await confirmed(true);
    expect(await audiences(id)).toEqual(["family", "receiving_facility", "referrer"]);
    expect((await CallRepository.listForReferral(id)).some((a) => a.purpose === "family_update")).toBe(true);
    const [row] = await db.query<{ attendant_consent_at: Date | null }>(`select attendant_consent_at from patient_details where referral_id = $1`, [id]);
    expect(row.attendant_consent_at).not.toBeNull();
  });

  it("leaves the family alone without consent, but still tells the hospital and the doctor", async () => {
    for (const consent of [false, undefined]) {
      await db.query(`delete from messages`);
      const id = await confirmed(consent);
      expect(await audiences(id)).toEqual(["receiving_facility", "referrer"]);
      expect((await CallRepository.listForReferral(id)).some((a) => a.purpose === "family_update")).toBe(false);
      const r = (await ReferralRepository.get(id))!;
      expect(await CallService.dispatchFamilyCall(r, "missed_call")).toBeNull();
    }
  });
});
