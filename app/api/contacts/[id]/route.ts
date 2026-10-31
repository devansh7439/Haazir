import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { ContactPatchBody } from "@/lib/modules/facility/facility.validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const c = await ScopeService.contact(s, (await params).id);
    return NextResponse.json(await DirectoryService.updateContact(c.id, await parseBody(req, ContactPatchBody)));
  });
}
