import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { EscalationService } from "@/lib/modules/escalation/escalation.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { ViewService } from "@/lib/modules/referral/view.service";
import { KRAIT, fakeBolna } from "./support/scripted-calls";
import { fakeClock, freshDb } from "./helpers";

const OTHER_ORG = "00000000-0000-4000-8000-0000000000e1";

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

describe("escalation numbers", () => {
  it("lists nothing until an admin adds a number, then in order", async () => {
    expect(await EscalationService.list(DEFAULT_ORG_ID)).toEqual([]);
    await EscalationService.add(DEFAULT_ORG_ID, { label: "State referral hospital", phone: "+91 80 4000 0002", sort_order: 2 });
    await EscalationService.add(DEFAULT_ORG_ID, { label: "District referral officer", phone: "+918040000001", sort_order: 1 });
    const list = await EscalationService.list(DEFAULT_ORG_ID);
    expect(list.map((c) => [c.label, c.phone_e164])).toEqual([
      ["District referral officer", "+918040000001"],
      ["State referral hospital", "+918040000002"],
    ]);
  });

  it("renames a number that is listed again, and refuses one that is not a phone number", async () => {
    await EscalationService.add(DEFAULT_ORG_ID, { label: "Control room", phone: "+918040000001", sort_order: 1 });
    await EscalationService.add(DEFAULT_ORG_ID, { label: "District control room", phone: "+918040000001", sort_order: 1 });
    expect((await EscalationService.list(DEFAULT_ORG_ID)).map((c) => c.label)).toEqual(["District control room"]);
    await expect(EscalationService.add(DEFAULT_ORG_ID, { label: "Nobody", phone: "abc", sort_order: 1 })).rejects.toMatchObject({ code: "BAD_NUMBER" });
  });

  it("removes only the organisation's own numbers, and a bad id is a plain not-found", async () => {
    await db.query(`insert into organisations (id, name) values ($1, 'Other')`, [OTHER_ORG]);
    const theirs = await EscalationService.add(OTHER_ORG, { label: "Their officer", phone: "+918040000009", sort_order: 1 });
    await expect(EscalationService.remove(DEFAULT_ORG_ID, theirs.id)).rejects.toMatchObject({ status: 404 });
    await expect(EscalationService.remove(DEFAULT_ORG_ID, "not-a-uuid")).rejects.toMatchObject({ status: 404 });
    expect(await EscalationService.list(OTHER_ORG)).toHaveLength(1);
    await EscalationService.remove(OTHER_ORG, theirs.id);
    expect(await EscalationService.list(OTHER_ORG)).toEqual([]);
  });

  it("is in the board view only once nobody accepted", async () => {
    fakeClock();
    fakeBolna();
    await EscalationService.add(DEFAULT_ORG_ID, { label: "District referral officer", phone: "+918040000001", sort_order: 1 });
    const { referral } = await ReferralService.create(KRAIT);
    expect((await ViewService.get(referral.id))!.escalation).toEqual([]);
    await ReferralRepository.update(referral.id, { status: "exhausted" }, ["searching"]);
    expect((await ViewService.get(referral.id))!.escalation).toEqual([{ label: "District referral officer", phone: "+918040000001" }]);
  });
});
