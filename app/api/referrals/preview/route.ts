import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { requireSession } from "@/lib/modules/auth/session.service";
import { PreviewBody } from "@/lib/modules/referral/referral.validation";
import { ApiError } from "@/lib/core/error";
import { ReferralService } from "@/lib/modules/referral/referral.service";

// Builds the spoken summary and lists eligible hospitals without creating anything.
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const input = await parseBody(req, PreviewBody);
    if (s.role === "doctor" && s.rid) input.referrer_id = s.rid;
    try {
      return NextResponse.json(await ReferralService.preview(input, { orgId: s.org }));
    } catch (err) {
      // The form shows note problems inline instead of failing the whole preview.
      if (err instanceof ApiError && err.code === "NOTE_CONTAINS_IDENTIFIER") {
        return NextResponse.json({ spoken_summary: null, warnings: [], errors: err.details.errors ?? [err.message], eligible: [], suggestions: [] });
      }
      throw err;
    }
  });
}
