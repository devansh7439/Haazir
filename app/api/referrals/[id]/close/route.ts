import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { closeReferral } from "@/lib/orchestrator";
import { CloseBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { reason, note } = await parseBody(req, CloseBody);
    await closeReferral((await params).id, reason, note);
    return NextResponse.json({ status: "closed" });
  });
}
