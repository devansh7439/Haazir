import { NextResponse } from "next/server";
import { errorResponse, handle } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { ViewService } from "@/lib/modules/referral/view.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const r = await ScopeService.referral(s, (await params).id);
    const view = await ViewService.get(r.id, r);
    return view ? NextResponse.json(view) : errorResponse(404, "NOT_FOUND", "Referral not found");
  });
}
