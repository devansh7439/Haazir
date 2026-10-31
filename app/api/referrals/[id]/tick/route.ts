import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { referralFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { advanceSimulation } from "@/lib/simulator";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";

// Called by the open console every 5 s (1 s when simulated). Idempotent.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const before = await referralFor(s, (await params).id);
    const id = before.id;
    const steps = before.is_simulated ? await advanceSimulation(id) : await WebhookService.recoverStale(id);
    const actions = await ReferralService.evaluate(id);
    const after = await ReferralRepository.get(id);
    return NextResponse.json({
      changed: steps > 0 || actions.length > 0 || after?.status !== before.status,
      actions,
      simulated_steps: before.is_simulated ? steps : 0,
      status: after?.status ?? before.status,
    });
  });
}
