import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import type { ReferralInput } from "@/lib/modules/referral/referral.type";
import { AnalyticsService } from "@/lib/modules/analytics/analytics.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { clinicalFactsOf, clinicalLine } from "@/lib/modules/referral/referral.helper";
import { KRAIT, fakeBolna } from "./support/scripted-calls";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { fakeClock, freshDb } from "./helpers";

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

const WITH_FACTS: ReferralInput = { ...KRAIT, airway: "intubated", spo2: 88, gcs: 9, on_oxygen: true, payer: "pmjay", medico_legal: false };

describe("clinical facts on a referral", () => {
  it("reads airway, SpO2 and GCS to every desk and gives the agent the rest to answer from", async () => {
    fakeClock();
    const calls = fakeBolna();
    const { referral } = await ReferralService.create(WITH_FACTS);
    expect(referral).toMatchObject({ airway: "intubated", spo2: 88, gcs: 9, on_oxygen: true, payer: "pmjay", medico_legal: false });
    expect(referral.spoken_summary).toContain("Intubated. Oxygen saturation 88 percent on oxygen. G C S 9.");
    expect(referral.spoken_summary).not.toContain("Ayushman");
    for (const c of calls) {
      const data = c.user_data as Record<string, string>;
      expect(data.case_summary).toBe(referral.spoken_summary);
      expect(data.known_facts).toBe(
        "Airway: intubated. Oxygen saturation: 88 percent. On oxygen: yes. G C S: 9. Payment: Ayushman Bharat card. Medico-legal case: no.",
      );
    }
  });

  it("says 'not stated' for facts the doctor left out, and keeps the summary as before", async () => {
    fakeClock();
    const calls = fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    expect(referral).toMatchObject({ airway: "unknown", spo2: null, gcs: null, payer: "unknown", medico_legal: null });
    expect(referral.spoken_summary).not.toContain("Intubated");
    expect((calls[0].user_data as Record<string, string>).known_facts).toContain("Airway: not stated.");
  });

  it("puts the facts in the pre-arrival note, and nothing when there are none", () => {
    expect(clinicalLine(clinicalFactsOf({ airway: "intubated", spo2: 88, on_oxygen: true, gcs: 9, payer: "pmjay", medico_legal: true }))).toBe(
      "Intubated · SpO2 88% on oxygen · GCS 9 · Payment: Ayushman Bharat · Medico-legal case",
    );
    expect(clinicalLine(clinicalFactsOf({}))).toBeNull();
  });
});

describe("proof figures", () => {
  it("counts referrals, the cost Bolna reports and the call length, and tells real hospitals from demo", async () => {
    fakeClock();
    fakeBolna();
    await ReferralService.create(KRAIT);
    for (const status of ["ringing", "in-progress", "call-disconnected"]) {
      await (await WebhookService.handle({ id: "exec-1", status })).followUp();
    }
    await (await WebhookService.handle({ id: "exec-1", status: "completed", transcript: "...", total_cost: "0.42", conversation_duration: 38 })).followUp();

    const all = await AnalyticsService.proofStats(DEFAULT_ORG_ID, false);
    expect(all).toMatchObject({ referrals: 1, placed: 0, calls: 6, median_ttfa_s: null, median_call_s: 38, total_cost: 0.42 });
    // The seed's hospitals are demo hospitals, so none of this counts as real.
    expect(await AnalyticsService.proofStats(DEFAULT_ORG_ID, true)).toMatchObject({ referrals: 0, calls: 0, total_cost: null });
  });

  it("ignores a cost or length that is missing or not a number", async () => {
    fakeClock();
    fakeBolna();
    await ReferralService.create(KRAIT);
    await (await WebhookService.handle({ id: "exec-1", status: "completed", transcript: "...", total_cost: "n/a", conversation_duration: -5 })).followUp();
    const row = (await db.query(`select cost, duration_s from call_attempts where bolna_execution_id = 'exec-1'`))[0];
    expect(row).toEqual({ cost: null, duration_s: null });
  });
});
