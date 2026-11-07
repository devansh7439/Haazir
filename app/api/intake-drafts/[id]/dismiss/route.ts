import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { IntakeService } from "@/lib/modules/intake/intake.service";
import { SessionService } from "@/lib/modules/auth/session.service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    await IntakeService.dismiss(s.org, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
