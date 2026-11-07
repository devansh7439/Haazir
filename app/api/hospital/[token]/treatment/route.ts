import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { HospitalService } from "@/lib/modules/hospital/hospital.service";
import { WithdrawBody } from "@/lib/modules/hospital/hospital.validation";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    await HospitalService.check(token);
    const b = await parseBody(req, WithdrawBody);
    return NextResponse.json(await HospitalService.treatmentStarted(token, b.code), { headers: { "Cache-Control": "no-store" } });
  });
}
