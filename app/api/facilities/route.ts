import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { createFacility, listFacilities } from "@/lib/directory";
import { requireSession } from "@/lib/session";
import { FacilityCreateBody } from "@/lib/validation";

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json({ facilities: await listFacilities(s.org) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    return NextResponse.json(await createFacility(s.org, await parseBody(req, FacilityCreateBody)), { status: 201 });
  });
}
