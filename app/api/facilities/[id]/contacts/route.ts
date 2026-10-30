import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { addFacilityContact } from "@/lib/directory";
import { ContactCreateBody } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () =>
    NextResponse.json(await addFacilityContact((await params).id, await parseBody(req, ContactCreateBody)), { status: 201 }),
  );
}
