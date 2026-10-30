import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { testCall } from "@/lib/demo";
import { requireDemoAdmin } from "@/lib/session";
import { TestCallBody } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => {
    await requireDemoAdmin();
    const { facility_id, consented_test } = await parseBody(req, TestCallBody);
    return NextResponse.json(await testCall(facility_id, consented_test), { status: 201 });
  });
}
