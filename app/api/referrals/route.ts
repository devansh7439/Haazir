import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { IntakeService } from "@/lib/modules/intake/intake.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { ReferralBody } from "@/lib/modules/referral/referral.validation";
import { ViewService } from "@/lib/modules/referral/view.service";
import { ReferralService } from "@/lib/modules/referral/referral.service";

export async function GET() {
  return handle(async () => {
    const s = await SessionService.require();
    return NextResponse.json({ referrals: await ViewService.list(s.org) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await SessionService.require();
    const body = await parseBody(req, ReferralBody);
    const { draft_id, ...input } = body;
    // A doctor always refers as themselves; an admin or coordinator may pick any referrer in their organisation, and the
    // referral records who keyed it in.
    if (s.role === "doctor" && s.rid) input.referrer_id = s.rid;
    const { referral, attempts, duplicate } = await ReferralService.create(input, { orgId: s.org, enteredBy: s.uid });
    if (draft_id) await IntakeService.markUsed(s.org, draft_id);
    return NextResponse.json(
      {
        id: referral.id,
        code: referral.code,
        status: referral.status,
        wave: referral.current_wave,
        attempts: attempts.map((a) => ({
          id: a.id, facility_id: a.facility_id, rank: a.rank, eta_minutes: a.eta_minutes, distance_km: a.distance_km,
          call_language: a.call_language, status: a.status, rank_reasons: a.rank_reasons,
        })),
      },
      { status: duplicate ? 200 : 201 },
    );
  });
}
