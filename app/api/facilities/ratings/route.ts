import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { requireSession } from "@/lib/modules/auth/session.service";
import { RatingService } from "@/lib/modules/facility/rating.service";

/** Google star ratings by hospital id. Loaded after the page, so a slow Google never delays the list. */
export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    return NextResponse.json(await RatingService.forOrg(s.org));
  });
}
