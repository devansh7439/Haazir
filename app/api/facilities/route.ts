import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { FacilityCreateBody } from "@/lib/modules/facility/facility.validation";

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json({ facilities: await DirectoryService.list(s.org) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    return NextResponse.json(await DirectoryService.create(s.org, await parseBody(req, FacilityCreateBody)), { status: 201 });
  });
}
