import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { DemoService } from "@/lib/modules/demo/demo.service";
import { requireDemoAdmin } from "@/lib/modules/auth/session.service";
import { TestCallBody } from "@/lib/modules/demo/demo.validation";

export async function POST(req: Request) {
  return handle(async () => {
    await requireDemoAdmin();
    const { facility_id, consented_test } = await parseBody(req, TestCallBody);
    return NextResponse.json(await DemoService.testCall(facility_id, consented_test), { status: 201 });
  });
}
