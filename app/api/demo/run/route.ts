import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { runDemoReferral } from "@/lib/demo";
import { requireDemoAdmin } from "@/lib/session";
import { DemoRunBody } from "@/lib/validation";

// Starts the demo-krait-bite referral, live or simulated.
export async function POST(req: Request) {
  return handle(async () => {
    await requireDemoAdmin();
    const { simulate } = await parseBody(req, DemoRunBody);
    const r = await runDemoReferral(simulate);
    return NextResponse.json({ id: r.id, code: r.code, simulated: r.is_simulated }, { status: 201 });
  });
}
