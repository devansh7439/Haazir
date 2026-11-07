import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { PushService } from "@/lib/modules/push/push.service";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { KRAIT, fakeBolna } from "./support/scripted-calls";
import { IDS, fakeClock, freshDb } from "./helpers";

interface Text { to: string; from: string; body: string; auth: string }

/** Stubs Twilio's message endpoint on top of the fake Bolna; returns the texts sent. */
function fakeTwilio(reply: () => Response = () => new Response(JSON.stringify({ sid: "SM1" }), { status: 201 })) {
  const sent: Text[] = [];
  const inner = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (!String(url).includes("api.twilio.com")) return inner(url, init);
    const form = new URLSearchParams(String(init?.body));
    sent.push({ to: form.get("To")!, from: form.get("From")!, body: form.get("Body")!, auth: String((init?.headers as Record<string, string>).Authorization) });
    return reply();
  }));
  return sent;
}

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  vi.stubEnv("SMS_PROVIDER", "twilio");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret");
  vi.stubEnv("TWILIO_SMS_FROM", "+15550001111");
  vi.stubEnv("APP_BASE_URL", "https://haazir.example/");
});
afterEach(async () => {
  await PushService.flush();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

describe("text message to the referring doctor", () => {
  it("goes to the doctor's own number with a link to the board, even with no push token", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const [doctor] = await db.query<{ phone_e164: string }>(`select phone_e164 from referrers where id = $1`, [IDS.referrer]);
    const sent = fakeTwilio();
    await PushService.notify(referral.id, "first_yes", IDS.banyan);
    await PushService.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: doctor.phone_e164, from: "+15550001111" });
    expect(sent[0].auth).toBe(`Basic ${Buffer.from("ACtest:secret").toString("base64")}`);
    expect(sent[0].body).toContain(`First yes ${referral.code}`);
    expect(sent[0].body).toContain("Banyan");
    expect(sent[0].body).toContain(`https://haazir.example/referrals/${referral.id}`);
    expect(sent[0].body).not.toContain("·");
  });

  it("never carries a patient or family detail", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    const sent = fakeTwilio();
    for (const kind of ["first_yes", "doctor_wanted", "hospital_called_back", "bed_held", "bed_declined", "exhausted", "not_arrived"] as const) {
      await PushService.notify(referral.id, kind, IDS.tamarind);
    }
    await PushService.flush();
    expect(sent).toHaveLength(7);
    expect(JSON.stringify(sent)).not.toMatch(/Ramesh|Lakshmi|9800000301|snake|krait/i);
  });

  it("sends nothing when SMS is off, and a failed send never breaks the call that caused it", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    vi.stubEnv("SMS_PROVIDER", "none");
    const off = fakeTwilio();
    await PushService.notify(referral.id, "first_yes", IDS.banyan);
    await PushService.flush();
    expect(off).toEqual([]);

    vi.stubEnv("SMS_PROVIDER", "twilio");
    const failing = fakeTwilio(() => new Response(JSON.stringify({ message: "invalid number" }), { status: 400 }));
    await expect(PushService.notify(referral.id, "bed_held", IDS.tamarind)).resolves.toBeUndefined();
    await PushService.flush();
    expect(failing).toHaveLength(1);
  });
});
