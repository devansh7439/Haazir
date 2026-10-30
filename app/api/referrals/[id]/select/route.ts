import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { selectAttempt } from "@/lib/orchestrator";
import { SelectBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { attempt_id, force } = await parseBody(req, SelectBody);
    const res = await selectAttempt((await params).id, attempt_id, force);
    return NextResponse.json(res, { status: res.status === "confirming" ? 202 : 200 });
  });
}
