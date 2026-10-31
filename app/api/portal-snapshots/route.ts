import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/core/route";
import { addSnapshots, latestSnapshots } from "@/lib/modules/portal/portal.service";
import { requireSession } from "@/lib/modules/auth/session.service";

// C4: readings from public bed portals (Aapat Setu, ICU Beds Saarthi, CHBMS …), entered by an admin or posted by a scraper.
const Body = z.object({
  snapshots: z
    .array(
      z.object({
        facility_id: z.string().uuid(),
        source: z.string().trim().min(1).max(80),
        icu_beds_free: z.number().int().min(0).max(5000).nullable().default(null),
        ventilators_free: z.number().int().min(0).max(5000).nullable().default(null),
        observed_at: z.string().datetime({ offset: true }),
      }),
    )
    .min(1)
    .max(500),
});

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json({ snapshots: await latestSnapshots(s.org) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const { snapshots } = await parseBody(req, Body);
    return NextResponse.json({ inserted: await addSnapshots(s.org, snapshots) }, { status: 201 });
  });
}
