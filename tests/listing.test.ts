import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/core/db";
import { setDb } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { freshDb } from "./helpers";

// Listing a hospital: its services and desk numbers go in together, or nothing does.

let db: Db;
beforeEach(async () => {
  db = await freshDb();
});
afterEach(async () => {
  setDb(null);
  await db.close();
});

const listing = (o: Record<string, unknown> = {}) => ({
  name: "Lotus Care Hospital",
  kind: "private_hospital",
  ownership: "private",
  address: "4 Temple Road",
  city: "Hoskote",
  district: "Bengaluru Rural",
  lat: 13.07,
  lng: 77.8,
  call_language: "en",
  whatsapp_number: null,
  capabilities: ["icu_bed", "ventilator"],
  contacts: [{ role: "casualty_desk", phone: "+919800000555", priority: 1, is_ivr: false }],
  ...o,
});
const count = async () => (await db.query<{ n: number }>(`select count(*)::int as n from facilities`))[0].n;

describe("DirectoryService.create", () => {
  it("lists a hospital with its services and desk number, visible to its organisation", async () => {
    const before = await count();
    const f = await DirectoryService.create(DEFAULT_ORG_ID, listing());
    expect(await count()).toBe(before + 1);
    const item = (await DirectoryService.list(DEFAULT_ORG_ID)).find((x) => x.id === f.id)!;
    expect([...item.capabilities].sort()).toEqual(["icu_bed", "ventilator"]);
    expect(item.contacts.map((c) => [c.role, c.phone_e164])).toEqual([["casualty_desk", "+919800000555"]]);
  });

  it("writes nothing when a service is unknown, a number is bad or a number is repeated", async () => {
    const before = await count();
    await expect(DirectoryService.create(DEFAULT_ORG_ID, listing({ capabilities: ["icu_bed", "teleportation"] }))).rejects.toMatchObject({ code: "UNKNOWN_CAPABILITY" });
    await expect(
      DirectoryService.create(DEFAULT_ORG_ID, listing({ contacts: [{ role: "casualty_desk", phone: "12", priority: 1, is_ivr: false }] })),
    ).rejects.toMatchObject({ code: "BAD_NUMBER" });
    const twice = { role: "casualty_desk", phone: "+919800000555", priority: 1, is_ivr: false };
    await expect(DirectoryService.create(DEFAULT_ORG_ID, listing({ contacts: [twice, { ...twice, role: "reception" }] }))).rejects.toMatchObject({ code: "DUPLICATE_NUMBER" });
    expect(await count()).toBe(before);
  });

  it("can list a hospital with no services or numbers yet", async () => {
    const f = await DirectoryService.create(DEFAULT_ORG_ID, listing({ capabilities: [], contacts: [] }));
    const item = (await DirectoryService.list(DEFAULT_ORG_ID)).find((x) => x.id === f.id)!;
    expect(item.capabilities).toEqual([]);
    expect(item.contacts).toEqual([]);
  });
});
