import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { patchFacility } from "@/lib/directory";
import { FacilityPatchBody } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => NextResponse.json(await patchFacility((await params).id, await parseBody(req, FacilityPatchBody))));
}
