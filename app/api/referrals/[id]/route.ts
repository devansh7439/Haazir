import { NextResponse } from "next/server";
import { errorResponse, handle } from "@/lib/core/route";
import { referralFor } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { getReferralView } from "@/lib/modules/referral/view.service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await referralFor(s, (await params).id);
    const view = await getReferralView(r.id);
    return view ? NextResponse.json(view) : errorResponse(404, "NOT_FOUND", "Referral not found");
  });
}
