import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { DismissAlertBody } from "@/lib/modules/referral/referral.validation";
import { ReferralService } from "@/lib/modules/referral/referral.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const r = await ScopeService.referral(s, (await params).id);
    const { event_id } = await parseBody(req, DismissAlertBody);
    await ReferralService.dismissAlert(r, event_id);
    return NextResponse.json({ ok: true });
  });
}
