import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { createReferral } from "@/lib/orchestrator";
import { ReferralBody } from "@/lib/validation";
import { listReferrals } from "@/lib/view";

export async function GET() {
  return handle(async () => NextResponse.json({ referrals: await listReferrals() }));
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await parseBody(req, ReferralBody);
    const { simulate, ...input } = body;
    const { referral, attempts } = await createReferral(input, { simulate });
    return NextResponse.json(
      {
        id: referral.id,
        code: referral.code,
        status: referral.status,
        simulated: referral.is_simulated,
        wave: referral.current_wave,
        attempts: attempts.map((a) => ({
          id: a.id, facility_id: a.facility_id, rank: a.rank, eta_minutes: a.eta_minutes, distance_km: a.distance_km,
          call_language: a.call_language, status: a.status, rank_reasons: a.rank_reasons,
        })),
      },
      { status: 201 },
    );
  });
}

