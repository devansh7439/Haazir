import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { HospitalService } from "@/lib/modules/hospital/hospital.service";
import { ReferralCodeBody } from "@/lib/modules/hospital/hospital.validation";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    await HospitalService.check(token);
    const b = await parseBody(req, ReferralCodeBody);
    return NextResponse.json(await HospitalService.withdraw(token, b.code), { headers: { "Cache-Control": "no-store" } });
  });
}
