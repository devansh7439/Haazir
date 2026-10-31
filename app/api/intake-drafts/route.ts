import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { IntakeService } from "@/lib/modules/intake/intake.service";
import { requireSession } from "@/lib/modules/auth/session.service";

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json({ drafts: await IntakeService.list(s.org) });
  });
}
