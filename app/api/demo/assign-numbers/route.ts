import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { DemoService } from "@/lib/modules/demo/demo.service";
import { requireDemoAdmin } from "@/lib/modules/auth/session.service";
import { AssignNumbersBody } from "@/lib/modules/demo/demo.validation";

export async function POST(req: Request) {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await DemoService.assignNumbers(await parseBody(req, AssignNumbersBody)));
  });
}
