import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { IntakeService } from "@/lib/modules/intake/intake.service";
import { SessionService } from "@/lib/modules/auth/session.service";

export async function GET() {
  return handle(async () => {
    const s = await SessionService.require();
    return NextResponse.json({ drafts: await IntakeService.list(s.org) });
  });
}
