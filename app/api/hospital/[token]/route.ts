import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { HospitalService } from "@/lib/modules/hospital/hospital.service";

// Authenticated by the private link's token itself (the hospital's desk screen), not by a console session.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const snapshot = await HospitalService.snapshot((await params).token);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  });
}
