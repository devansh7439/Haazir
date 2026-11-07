import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { requireSession } from "@/lib/modules/auth/session.service";
import { EscalationService } from "@/lib/modules/escalation/escalation.service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    await EscalationService.remove(s.org, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
