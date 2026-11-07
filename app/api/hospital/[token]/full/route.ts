import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { HospitalService } from "@/lib/modules/hospital/hospital.service";
import { FullBody } from "@/lib/modules/hospital/hospital.validation";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    await HospitalService.check(token);
    const b = await parseBody(req, FullBody);
    return NextResponse.json(await HospitalService.setFull(token, b.full, b.hours), { headers: { "Cache-Control": "no-store" } });
  });
}
