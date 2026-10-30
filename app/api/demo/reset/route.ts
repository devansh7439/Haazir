import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { resetDemo } from "@/lib/demo";
import { requireDemoAdmin } from "@/lib/session";

export async function POST() {
  return handle(async () => {
    await requireDemoAdmin();
    return NextResponse.json(await resetDemo());
  });
}
