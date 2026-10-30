import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/core/route";
import { widenReferral } from "@/lib/orchestrator";
import { referralFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const r = await referralFor(s, (await params).id);
    const { radius_km } = await parseBody(req, z.object({ radius_km: z.number().int().min(1).max(300).default(80) }));
    const next = await widenReferral(r.id, radius_km);
    return NextResponse.json({ id: next.id, code: next.code }, { status: 201 });
  });
}
