import { NextResponse } from "next/server";
import { errorResponse, handle } from "@/lib/api";
import { referralFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { getReferralView } from "@/lib/view";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await referralFor(s, (await params).id);
    const view = await getReferralView(r.id);
    return view ? NextResponse.json(view) : errorResponse(404, "NOT_FOUND", "Referral not found");
  });
}
