import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { selectAttempt } from "@/lib/orchestrator";
import { referralFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { SelectBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await referralFor(s, (await params).id);
    const { attempt_id, force } = await parseBody(req, SelectBody);
    const res = await selectAttempt(r.id, attempt_id, force);
    return NextResponse.json(res, { status: res.status === "confirming" ? 202 : 200 });
  });
}
