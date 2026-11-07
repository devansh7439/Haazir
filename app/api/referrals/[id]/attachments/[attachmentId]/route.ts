import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { AttachmentService } from "@/lib/modules/attachment/attachment.service";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const { id, attachmentId } = await params;
    const r = await ScopeService.referral(s, id);
    await AttachmentService.remove(r, attachmentId);
    return NextResponse.json({ status: "removed" });
  });
}
