import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { demoStatus } from "@/lib/modules/demo/demo.service";
import { requireDemoAdmin } from "@/lib/modules/auth/session.service";

export async function GET() {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await demoStatus());
  });
}
