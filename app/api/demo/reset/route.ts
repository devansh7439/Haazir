import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { DemoService } from "@/lib/modules/demo/demo.service";
import { requireDemoAdmin } from "@/lib/modules/auth/session.service";

export async function POST() {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await DemoService.reset());
  });
}
