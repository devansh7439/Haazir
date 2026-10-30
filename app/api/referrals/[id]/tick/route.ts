import { NextResponse } from "next/server";
import { errorResponse, handle } from "@/lib/api";
import { evaluateReferral } from "@/lib/orchestrator";
import { getReferral } from "@/lib/repo";
import { advanceSimulation } from "@/lib/simulator";

// Called by the open console every 5 s (1 s when simulated). Idempotent.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = (await params).id;
    const before = await getReferral(id);
    if (!before) return errorResponse(404, "NOT_FOUND", "Referral not found");
    const simulated = before.is_simulated ? await advanceSimulation(id) : 0;
    const actions = await evaluateReferral(id);
    const after = await getReferral(id);
    return NextResponse.json({
      changed: simulated > 0 || actions.length > 0 || after?.status !== before.status,
      actions,
      simulated_steps: simulated,
      status: after?.status ?? before.status,
    });
  });
}
