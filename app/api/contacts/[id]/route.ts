import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { patchContact } from "@/lib/directory";
import { ContactPatchBody } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => NextResponse.json(await patchContact((await params).id, await parseBody(req, ContactPatchBody))));
}
