import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { recordManualOutcome } from "@/lib/orchestrator";
import { ManualOutcomeBody } from "@/lib/validation";

// The doctor records what a desk told them on a direct call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await parseBody(req, ManualOutcomeBody);
    const a = await recordManualOutcome((await params).id, body);
    return NextResponse.json({ id: a?.id, outcome: a?.outcome, outcome_source: "manual" });
  });
}
