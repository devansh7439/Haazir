import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { RegistrationService } from "@/lib/modules/auth/registration.service";
import { requireSession } from "@/lib/modules/auth/session.service";

export async function GET() {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    return NextResponse.json({ referrers: await RegistrationService.list(s.org) });
  });
}
