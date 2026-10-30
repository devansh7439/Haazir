import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/api";
import { widenReferral } from "@/lib/orchestrator";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { radius_km } = await parseBody(req, z.object({ radius_km: z.number().int().min(1).max(300).default(80) }));
    const r = await widenReferral((await params).id, radius_km);
    return NextResponse.json({ id: r.id, code: r.code }, { status: 201 });
  });
}
