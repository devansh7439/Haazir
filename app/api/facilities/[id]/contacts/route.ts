import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { addFacilityContact } from "@/lib/directory";
import { facilityFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { ContactCreateBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const f = await facilityFor(s, (await params).id);
    return NextResponse.json(await addFacilityContact(f.id, await parseBody(req, ContactCreateBody)), { status: 201 });
  });
}
