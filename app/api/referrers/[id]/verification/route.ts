import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { VerificationBody } from "@/lib/modules/auth/auth.validation";
import { RegistrationService } from "@/lib/modules/auth/registration.service";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const referrer = await ScopeService.referrer(s, (await params).id);
    const { decision } = await parseBody(req, VerificationBody);
    const r = await RegistrationService.decide(s, referrer, decision);
    return NextResponse.json({ verification_status: r.verification_status, verified_at: r.verified_at });
  });
}
