import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { recoverStaleAttempts } from "@/lib/handlers";
import { evaluateReferral } from "@/lib/orchestrator";
import { getReferral } from "@/lib/repo";
import { referralFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { advanceSimulation } from "@/lib/simulator";

// Called by the open console every 5 s (1 s when simulated). Idempotent.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const before = await referralFor(s, (await params).id);
    const id = before.id;
    const steps = before.is_simulated ? await advanceSimulation(id) : await recoverStaleAttempts(id);
    const actions = await evaluateReferral(id);
    const after = await getReferral(id);
    return NextResponse.json({
      changed: steps > 0 || actions.length > 0 || after?.status !== before.status,
      actions,
      simulated_steps: before.is_simulated ? steps : 0,
      status: after?.status ?? before.status,
    });
  });
}
