import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { FacilityCreateBody } from "@/lib/modules/facility/facility.validation";

export async function GET() {
  return handle(async () => {
    const s = await SessionService.require();
    return NextResponse.json({ facilities: await DirectoryService.list(s.org) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await SessionService.require({ admin: true });
    return NextResponse.json(await DirectoryService.create(s.org, await parseBody(req, FacilityCreateBody)), { status: 201 });
  });
}
