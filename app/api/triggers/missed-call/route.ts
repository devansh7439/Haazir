import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/core/config";
import { MissedCallService } from "@/lib/modules/call/missed-call.service";

// C3: point your telephony provider's missed-call / inbound webhook here:
//   POST /api/triggers/missed-call?token=<MISSED_CALL_SECRET>   body: JSON {"from": "+91…"} or form fields From / CallFrom.

function authorized(req: Request): boolean {
  const secret = env.missedCallSecret;
  if (!secret) return false;
  const token = new URL(req.url).searchParams.get("token") ?? (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { action, followUp } = await MissedCallService.handle(await req.text());
  if (followUp) after(followUp);
  return NextResponse.json({ ok: true, action });
}
