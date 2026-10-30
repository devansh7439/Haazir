import { NextResponse, after } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { cancelReferral } from "@/lib/orchestrator";
import { CancelBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { reason } = await parseBody(req, CancelBody);
    after(await cancelReferral((await params).id, reason));
    return NextResponse.json({ status: "cancelled" });
  });
}
