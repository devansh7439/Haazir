import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { assignNumbers } from "@/lib/modules/demo/demo.service";
import { requireDemoAdmin } from "@/lib/modules/auth/session.service";
import { AssignNumbersBody } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await assignNumbers(await parseBody(req, AssignNumbersBody)));
  });
}
