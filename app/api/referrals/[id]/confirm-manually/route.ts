import { NextResponse, after } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { confirmManually } from "@/lib/orchestrator";
import { referralFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { ConfirmManuallyBody } from "@/lib/validation";

// The doctor already spoke to the hospital: skip the hold call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await referralFor(s, (await params).id);
    const { attempt_id, contact_person } = await parseBody(req, ConfirmManuallyBody);
    after(await confirmManually(r.id, attempt_id, contact_person));
    return NextResponse.json({ status: "confirmed" });
  });
}
