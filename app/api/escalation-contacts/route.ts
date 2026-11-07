import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { SessionService } from "@/lib/modules/auth/session.service";
import { EscalationService } from "@/lib/modules/escalation/escalation.service";
import { EscalationCreateBody } from "@/lib/modules/escalation/escalation.validation";

export async function POST(req: Request) {
  return handle(async () => {
    const s = await SessionService.require({ admin: true });
    return NextResponse.json(await EscalationService.add(s.org, await parseBody(req, EscalationCreateBody)), { status: 201 });
  });
}
