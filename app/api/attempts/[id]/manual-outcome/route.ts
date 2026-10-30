import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { recordManualOutcome } from "@/lib/orchestrator";
import { attemptFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { ManualOutcomeBody } from "@/lib/validation";

// The doctor records what a desk told them on a direct call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const a = await attemptFor(s, (await params).id);
    const body = await parseBody(req, ManualOutcomeBody);
    const updated = await recordManualOutcome(a.id, body);
    return NextResponse.json({ id: updated?.id, outcome: updated?.outcome, outcome_source: "manual" });
  });
}
