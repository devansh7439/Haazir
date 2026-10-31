import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { patchFacility } from "@/lib/modules/facility/directory.service";
import { facilityFor } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { FacilityPatchBody } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const f = await facilityFor(s, (await params).id);
    return NextResponse.json(await patchFacility(f.id, await parseBody(req, FacilityPatchBody)));
  });
}
