import { describe, expect, it } from "vitest";
import type { Capability } from "@/lib/core/types";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";
import { filterFacilities, firstDesk, groupByCategory, mapsLink } from "@/lib/ui/facility";

const cap = (code: string, category: string): Capability => ({ code, label: code, spoken_en: code, category });
const CAPS = [cap("icu_bed", "bed"), cap("ventilator", "equipment"), cap("ct_24x7", "service"), cap("neurosurgeon", "specialist"), cap("asv_stock", "drug"), cap("odd", "novel")];
const contact = (o: Record<string, unknown>) => ({ id: "c", phone_e164: "+911", role: "casualty_desk", priority: 1, is_ivr: false, active: true, ...o }) as FacilityListItem["contacts"][number];
const hospital = (o: Partial<FacilityListItem>): FacilityListItem => ({ id: "f", name: "Banyan Hospital", city: "Hoskote", district: "Bengaluru Rural", capabilities: [], contacts: [], ...o }) as FacilityListItem;

describe("groupByCategory", () => {
  it("orders groups beds, equipment, services, specialists, drugs, then anything new", () => {
    expect(groupByCategory(CAPS).map((g) => g.title)).toEqual(["Beds", "Equipment", "Services", "Specialists", "Drugs and stock", "novel"]);
  });

  it("keeps only the codes asked for and drops empty groups", () => {
    const g = groupByCategory(CAPS, ["ventilator", "icu_bed"]);
    expect(g.map((x) => [x.title, x.items.map((i) => i.code)])).toEqual([["Beds", ["icu_bed"]], ["Equipment", ["ventilator"]]]);
    expect(groupByCategory(CAPS, [])).toEqual([]);
  });
});

describe("filterFacilities", () => {
  const rows = [
    hospital({ id: "a", name: "Banyan Hospital", capabilities: ["icu_bed", "ventilator"] }),
    hospital({ id: "b", name: "Neem Centre", city: "Devanahalli", capabilities: ["icu_bed"] }),
    hospital({ id: "c", name: "Lotus", city: null, district: null, capabilities: [] }),
  ];

  it("matches the name, city or district, ignoring case", () => {
    expect(filterFacilities(rows, "banyan", []).map((r) => r.id)).toEqual(["a"]);
    expect(filterFacilities(rows, "DEVANAHALLI", []).map((r) => r.id)).toEqual(["b"]);
    expect(filterFacilities(rows, "rural", []).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("requires every chosen service", () => {
    expect(filterFacilities(rows, "", ["icu_bed"]).map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterFacilities(rows, "", ["icu_bed", "ventilator"]).map((r) => r.id)).toEqual(["a"]);
    expect(filterFacilities(rows, "neem", ["ventilator"])).toEqual([]);
    expect(filterFacilities(rows, "", [])).toHaveLength(3);
  });
});

describe("firstDesk and links", () => {
  it("prefers a direct line over a phone menu, then the lowest priority, and skips inactive numbers", () => {
    const f = hospital({ contacts: [contact({ id: "menu", priority: 1, is_ivr: true }), contact({ id: "p2", priority: 2 }), contact({ id: "p1", priority: 1, active: false }), contact({ id: "p3", priority: 3 })] });
    expect(firstDesk(f)?.id).toBe("p2");
    expect(firstDesk(hospital({ contacts: [contact({ active: false })] }))).toBeNull();
  });

  it("builds a Maps link from the coordinates", () => {
    expect(mapsLink(13.07, 77.8)).toBe("https://www.google.com/maps/search/?api=1&query=13.07,77.8");
  });
});
