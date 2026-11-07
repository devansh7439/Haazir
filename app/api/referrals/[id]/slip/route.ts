import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { SlipService } from "@/lib/modules/referral/slip.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await ScopeService.referral(s, (await params).id);
    return NextResponse.json({ slip: await SlipService.get(r) });
  });
}
