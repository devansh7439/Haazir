import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { EvaluationService } from "@/lib/modules/referral/evaluation.service";
import { WebhookService } from "@/lib/modules/call/webhook.service";

// Called by the open console every 5 s. Idempotent.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const before = await ScopeService.referral(s, (await params).id);
    const id = before.id;
    const recovered = await WebhookService.recoverStale(id);
    const actions = await EvaluationService.evaluate(id);
    const after = await ReferralRepository.get(id);
    return NextResponse.json({
      changed: recovered > 0 || actions.length > 0 || after?.status !== before.status,
      actions,
      status: after?.status ?? before.status,
    });
  });
}
