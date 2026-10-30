import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { setCapabilities } from "@/lib/directory";
import { facilityFor } from "@/lib/scope";
import { requireSession } from "@/lib/session";
import { CapabilitiesBody } from "@/lib/validation";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const f = await facilityFor(s, (await params).id);
    const { codes } = await parseBody(req, CapabilitiesBody);
    return NextResponse.json({ codes: await setCapabilities(f.id, codes) });
  });
}
