import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { dismissDraft } from "@/lib/intake";
import { requireSession } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    await dismissDraft(s.org, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
