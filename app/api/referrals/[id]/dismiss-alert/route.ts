import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { addEvent } from "@/lib/events";
import { AppError, getReferral } from "@/lib/repo";
import { DismissAlertBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = (await params).id;
    const { event_id } = await parseBody(req, DismissAlertBody);
    if (!(await getReferral(id))) throw new AppError(404, "NOT_FOUND", "Referral not found");
    await addEvent(id, "alert_dismissed", { event_id });
    return NextResponse.json({ ok: true });
  });
}
