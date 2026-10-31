import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { DismissAlertBody } from "@/lib/modules/referral/referral.validation";
import { EventRepository } from "@/lib/modules/event/event.repository";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await ScopeService.referral(s, (await params).id);
    const { event_id } = await parseBody(req, DismissAlertBody);
    await EventRepository.add(r.id, "alert_dismissed", { event_id });
    return NextResponse.json({ ok: true });
  });
}
