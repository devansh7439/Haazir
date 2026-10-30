import { NextResponse, after } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { confirmManually } from "@/lib/orchestrator";
import { ConfirmManuallyBody } from "@/lib/validation";

// The doctor already spoke to the hospital: skip the hold call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { attempt_id, contact_person } = await parseBody(req, ConfirmManuallyBody);
    const followUp = await confirmManually((await params).id, attempt_id, contact_person);
    after(followUp);
    return NextResponse.json({ status: "confirmed" });
  });
}
