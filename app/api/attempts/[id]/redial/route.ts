import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { redialManually } from "@/lib/orchestrator";
import { attemptFor, contactFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { RedialBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession();
    const a = await attemptFor(s, (await params).id);
    const body = await parseBody(req, RedialBody);
    if (body.contact_id) await contactFor(s, body.contact_id);
    const child = await redialManually(a.id, body);
    return NextResponse.json({ id: child.id, status: child.status, to_number: child.to_number }, { status: 201 });
  });
}
