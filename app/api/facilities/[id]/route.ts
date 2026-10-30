import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { patchFacility } from "@/lib/directory";
import { facilityFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { FacilityPatchBody } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const f = await facilityFor(s, (await params).id);
    return NextResponse.json(await patchFacility(f.id, await parseBody(req, FacilityPatchBody)));
  });
}
