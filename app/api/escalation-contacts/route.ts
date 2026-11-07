import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { requireSession } from "@/lib/modules/auth/session.service";
import { EscalationService } from "@/lib/modules/escalation/escalation.service";
import { EscalationCreateBody } from "@/lib/modules/escalation/escalation.validation";

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession({ admin: true });
    return NextResponse.json(await EscalationService.add(s.org, await parseBody(req, EscalationCreateBody)), { status: 201 });
  });
}
