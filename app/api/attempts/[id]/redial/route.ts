import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { redialManually } from "@/lib/orchestrator";
import { RedialBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await parseBody(req, RedialBody);
    const a = await redialManually((await params).id, body);
    return NextResponse.json({ id: a.id, status: a.status, to_number: a.to_number }, { status: 201 });
  });
}
