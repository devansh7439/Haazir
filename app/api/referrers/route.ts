import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { RegistrationService } from "@/lib/modules/auth/registration.service";
import { SessionService } from "@/lib/modules/auth/session.service";

export async function GET() {
  return handle(async () => {
    const s = await SessionService.require({ admin: true });
    return NextResponse.json({ referrers: await RegistrationService.list(s.org) });
  });
}
