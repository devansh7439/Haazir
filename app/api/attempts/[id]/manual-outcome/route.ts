import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { ManualOutcomeBody } from "@/lib/modules/call/call.validation";
import { CallService } from "@/lib/modules/call/call.service";

// The doctor records what a desk told them on a direct call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const a = await ScopeService.attempt(s, (await params).id);
    const body = await parseBody(req, ManualOutcomeBody);
    const updated = await CallService.recordManualOutcome(a.id, body);
    return NextResponse.json({ id: updated?.id, outcome: updated?.outcome, outcome_source: "manual" });
  });
}
