import { NextResponse, after } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { cancelReferral } from "@/lib/orchestrator";
import { referralFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { CancelBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await referralFor(s, (await params).id);
    const { reason } = await parseBody(req, CancelBody);
    after(await cancelReferral(r.id, reason));
    return NextResponse.json({ status: "cancelled" });
  });
}
