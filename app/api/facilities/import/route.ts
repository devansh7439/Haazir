import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { SessionService } from "@/lib/modules/auth/session.service";
import { ImportBody } from "@/lib/modules/facility/facility.validation";
import { ImportService } from "@/lib/modules/facility/import.service";

export async function POST(req: Request) {
  return handle(async () => {
    const s = await SessionService.require({ admin: true });
    const { csv, apply } = await parseBody(req, ImportBody);
    return NextResponse.json(await ImportService.run(s.org, csv, apply));
  });
}
