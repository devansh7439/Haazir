import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { now } from "@/lib/core/clock";
import { addSnapshots } from "@/lib/portal";
import { requireDemoAdmin } from "@/lib/session";
import { DEFAULT_ORG_ID } from "@/lib/core/types";

// Loads fictional portal readings for the demo story: Neem's portal row says ICU beds are free (its desk will say full),
// and Banyan's says none (its desk will say yes). Both show up as "portal vs desk" flags.
export async function POST() {
  return handle(async () => {
    await requireDemoAdmin();
    const observed_at = new Date(now().getTime() - 40 * 60_000).toISOString();
    const source = "Demo bed portal (fictional)";
    const inserted = await addSnapshots(DEFAULT_ORG_ID, [
      { facility_id: "00000000-0000-4000-8000-000000000102", source, icu_beds_free: 3, ventilators_free: 2, observed_at },
      { facility_id: "00000000-0000-4000-8000-000000000101", source, icu_beds_free: 0, ventilators_free: 0, observed_at },
      { facility_id: "00000000-0000-4000-8000-000000000103", source, icu_beds_free: 1, ventilators_free: 1, observed_at },
    ]);
    return NextResponse.json({ inserted });
  });
}
