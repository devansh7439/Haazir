import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { RegistrationBody } from "@/lib/modules/auth/auth.validation";
import { RegistrationService } from "@/lib/modules/auth/registration.service";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { SessionService } from "@/lib/modules/auth/session.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await SessionService.require();
    const referrer = await ScopeService.referrer(s, (await params).id);
    const body = await parseBody(req, RegistrationBody);
    const r = await RegistrationService.submit(s, referrer, body);
    return NextResponse.json({
      verification_status: r.verification_status,
      registration_no: r.registration_no,
      registration_council: r.registration_council,
    });
  });
}
