import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { POST, GET } from "@/app/api/bridge/answer/route";
import { declineXml, dialXml } from "@/lib/modules/call/bridge.helper";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { KRAIT, fakeBolna } from "./support/scripted-calls";
import { IDS, fakeClock, freshDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
  vi.stubEnv("BRIDGE_SECRET", "bridge-secret");
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  setClock(null);
  setDb(null);
  await db.close();
});

const TAMARIND_DESK = "+910000000103";
const ask = (from: string, token = "bridge-secret") =>
  POST(new Request(`http://app.test/api/bridge/answer?token=${token}`, { method: "POST", body: new URLSearchParams({ From: from, To: "+911234567890" }) }));
const doctorPhone = async () => (await ReferralRepository.referrer(IDS.referrer))!.phone_e164;

describe("bridge number for a live transfer", () => {
  it("rings the referring doctor when a desk we just called is transferred", async () => {
    fakeClock();
    fakeBolna();
    await ReferralService.create(KRAIT);
    const res = await ask(TAMARIND_DESK);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("xml");
    expect(await res.text()).toBe(dialXml(await doctorPhone()));
  });

  it("dials nobody for a number we did not call, or when the call is too old", async () => {
    const clock = fakeClock();
    fakeBolna();
    await ReferralService.create(KRAIT);
    expect(await (await ask("+919999999999")).text()).toBe(declineXml());
    clock.advance(11 * 60);
    expect(await (await ask(TAMARIND_DESK)).text()).toBe(declineXml());
  });

  it("dials nobody once the referral is closed", async () => {
    fakeClock();
    fakeBolna();
    const { referral } = await ReferralService.create(KRAIT);
    await ReferralRepository.update(referral.id, { status: "closed" });
    expect(await (await ask(TAMARIND_DESK)).text()).toBe(declineXml());
  });

  it("needs the token, and never dials a number the caller supplies", async () => {
    fakeClock();
    fakeBolna();
    await ReferralService.create(KRAIT);
    expect((await ask(TAMARIND_DESK, "wrong")).status).toBe(401);
    vi.stubEnv("BRIDGE_SECRET", "");
    expect((await ask(TAMARIND_DESK, "")).status).toBe(401);
    vi.stubEnv("BRIDGE_SECRET", "bridge-secret");
    const body = new URLSearchParams({ From: TAMARIND_DESK, To: "+918888888888", Number: "+917777777777" });
    const text = await (await POST(new Request("http://app.test/api/bridge/answer?token=bridge-secret", { method: "POST", body }))).text();
    expect(text).toContain(await doctorPhone());
    expect(text).not.toContain("7777777777");
  });

  it("answers a GET with the caller in the query", async () => {
    fakeClock();
    fakeBolna();
    await ReferralService.create(KRAIT);
    const res = await GET(new Request(`http://app.test/api/bridge/answer?token=bridge-secret&From=${encodeURIComponent(TAMARIND_DESK)}`));
    expect(await res.text()).toBe(dialXml(await doctorPhone()));
  });

  it("escapes what it writes into the XML", () => {
    expect(dialXml("+91<1>&")).toContain("+91&lt;1&gt;&amp;");
  });
});
