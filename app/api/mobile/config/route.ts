import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { MobileService } from "@/lib/modules/mobile/mobile.service";

// Public: the app reads it before sign-in to choose between the passcode and the email form.
export async function GET() {
  return handle(async () => NextResponse.json(MobileService.config()));
}
