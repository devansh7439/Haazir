import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { SelectBody } from "@/lib/modules/referral/referral.validation";
import { HoldService } from "@/lib/modules/referral/hold.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await ScopeService.referral(s, (await params).id);
    const { attempt_id, force } = await parseBody(req, SelectBody);
    const res = await HoldService.select(r.id, attempt_id, force);
    return NextResponse.json(res, { status: res.status === "confirming" ? 202 : 200 });
  });
}
