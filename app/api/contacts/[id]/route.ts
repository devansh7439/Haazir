import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { patchContact } from "@/lib/modules/facility/directory.service";
import { contactFor } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { ContactPatchBody } from "@/lib/validation";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const c = await contactFor(s, (await params).id);
    return NextResponse.json(await patchContact(c.id, await parseBody(req, ContactPatchBody)));
  });
}
