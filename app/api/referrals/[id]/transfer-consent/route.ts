import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { TransferConsentBody } from "@/lib/modules/referral/referral.validation";
import { SlipService } from "@/lib/modules/referral/slip.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const r = await ScopeService.referral(s, (await params).id);
    const { transfer_consent, transfer_reason } = await parseBody(req, TransferConsentBody);
    const updated = await SlipService.recordConsent(r, transfer_consent, transfer_reason ?? null);
    return NextResponse.json({
      transfer_consent: updated.transfer_consent,
      transfer_consent_at: updated.transfer_consent_at,
      transfer_reason: updated.transfer_reason,
    });
  });
}
