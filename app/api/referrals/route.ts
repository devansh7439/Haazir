import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { createReferral } from "@/lib/orchestrator";
import { markDraftUsed } from "@/lib/intake";
import { requireSession } from "@/lib/session";
import { ReferralBody } from "@/lib/validation";
import { listReferrals } from "@/lib/view";

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json({ referrals: await listReferrals(s.org) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const body = await parseBody(req, ReferralBody);
    const { simulate, draft_id, ...input } = body;
    // A doctor always refers as themselves; only an admin may pick another referrer in their organisation.
    if (s.role === "doctor" && s.rid) input.referrer_id = s.rid;
    const { referral, attempts, duplicate } = await createReferral(input, { simulate, orgId: s.org });
    if (draft_id) await markDraftUsed(s.org, draft_id);
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
      { status: duplicate ? 200 : 201 },
    );
  });
}
