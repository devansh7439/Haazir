import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { listDrafts } from "@/lib/intake";
import { requireSession } from "@/lib/session";

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json({ drafts: await listDrafts(s.org) });
  });
}
