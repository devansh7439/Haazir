import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { assignNumbers } from "@/lib/demo";
import { requireDemoAdmin } from "@/lib/session";
import { AssignNumbersBody } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await assignNumbers(await parseBody(req, AssignNumbersBody)));
  });
}
