import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { MaintenanceService } from "@/lib/modules/maintenance/maintenance.service";

// Called by the open console every 5 s. Idempotent.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const referral = await ScopeService.referral(s, (await params).id);
    return NextResponse.json(await MaintenanceService.tickReferral(referral));
  });
}
