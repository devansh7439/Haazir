import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";
import { setDb } from "@/lib/core/db";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CONTACT_STALE_AFTER_DAYS, contactFreshness } from "@/lib/modules/facility/freshness.helper";
import { fakeClock, freshDb } from "./helpers";

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});
afterEach(async () => {
  setClock(null);
  setDb(null);
  await db.close();
});

describe("number freshness", () => {
  const DAY = 24 * 3600_000;
  const t0 = Date.UTC(2026, 0, 1);

  it("is unverified when never confirmed, stale after the limit, fresh before it", () => {
    expect(contactFreshness(null, t0)).toBe("unverified");
    expect(contactFreshness(new Date(t0 - (CONTACT_STALE_AFTER_DAYS - 1) * DAY), t0)).toBe("fresh");
    expect(contactFreshness(new Date(t0 - (CONTACT_STALE_AFTER_DAYS + 1) * DAY).toISOString(), t0)).toBe("stale");
  });

  it("is refreshed by a call that someone answered, not by a missed call or a phone menu", async () => {
    const clock = fakeClock();
    await db.query(`update facility_contacts set verified_at = null`);
    const [desk] = await db.query<{ id: string }>(`select id from facility_contacts where not is_ivr limit 1`);
    const [menu] = await db.query<{ id: string }>(`select id from facility_contacts where is_ivr limit 1`);
    const verifiedAt = async (id: string) => (await db.query<{ verified_at: Date | null }>(`select verified_at from facility_contacts where id = $1`, [id]))[0].verified_at;

    await CallRepository.bumpContactStats(desk.id, false, "no_answer");
    expect(await verifiedAt(desk.id)).toBeNull();

    await CallRepository.bumpContactStats(menu.id, true, "completed");
    expect(await verifiedAt(menu.id)).toBeNull();

    await CallRepository.bumpContactStats(desk.id, true, "accepted");
    expect(new Date((await verifiedAt(desk.id))!).getTime()).toBe(clock.now.getTime());
  });
});
