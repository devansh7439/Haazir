import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { resetDemo } from "@/lib/demo";
import { requireDemoAdmin } from "@/lib/session";

export async function POST() {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await resetDemo());
  });
}
