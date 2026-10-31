import { NextResponse, after } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { CancelBody } from "@/lib/modules/referral/referral.validation";
import { ReferralService } from "@/lib/modules/referral/referral.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await ScopeService.referral(s, (await params).id);
    const { reason } = await parseBody(req, CancelBody);
    after(await ReferralService.cancel(r.id, reason));
    return NextResponse.json({ status: "cancelled" });
  });
}
