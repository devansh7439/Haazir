import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { ScopeService } from "@/lib/modules/auth/scope.service";
import { requireSession } from "@/lib/modules/auth/session.service";
import { HospitalService } from "@/lib/modules/hospital/hospital.service";

/** Makes the hospital's desk-screen link, or replaces it (the old one stops working). The address is returned once. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    const f = await ScopeService.facility(s, (await params).id);
    return NextResponse.json(await HospitalService.createLink(s.org, f.id), { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
