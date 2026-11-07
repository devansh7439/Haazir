import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { ReferralService } from "@/lib/modules/referral/referral.service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await ScopeService.referral(s, (await params).id);
    const updated = await ReferralService.recordTreatmentStarted(r);
    return NextResponse.json({ treatment_started_at: updated.treatment_started_at });
  });
}
