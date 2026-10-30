import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { demoStatus } from "@/lib/demo";
import { requireDemoAdmin } from "@/lib/session";

export async function GET() {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await demoStatus());
  });
}
