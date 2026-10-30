import { NextResponse } from "next/server";
import { errorResponse, handle } from "@/lib/api";
import { getReferralView } from "@/lib/view";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const view = await getReferralView((await params).id);
    return view ? NextResponse.json(view) : errorResponse(404, "NOT_FOUND", "Referral not found");
  });
}
