import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { dismissDraft } from "@/lib/modules/intake/intake.service";
import { requireSession } from "@/lib/modules/auth/session.service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    await dismissDraft(s.org, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
