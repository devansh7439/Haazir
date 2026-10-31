import { NextResponse, after } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { referralFor } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { ConfirmManuallyBody } from "@/lib/validation";
import { ReferralService } from "@/lib/modules/referral/referral.service";

// The doctor already spoke to the hospital: skip the hold call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await referralFor(s, (await params).id);
    const { attempt_id, contact_person } = await parseBody(req, ConfirmManuallyBody);
    after(await ReferralService.confirmManually(r.id, attempt_id, contact_person));
    return NextResponse.json({ status: "confirmed" });
  });
}
