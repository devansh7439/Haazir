import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { SessionService } from "@/lib/modules/auth/session.service";
import { MobileService } from "@/lib/modules/mobile/mobile.service";

export async function GET() {
  return handle(async () => {
    const s = await SessionService.require();
    return NextResponse.json(await MobileService.bootstrap(s));
  });
}
