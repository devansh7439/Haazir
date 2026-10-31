import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { normalizePhone } from "@/lib/core/normalize";
import { CallService } from "@/lib/modules/call/call.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

// C3: a family member on a feature phone gives a missed call to our number; we call them back with the update in
// their language (the family-update agent). Point your telephony provider's missed-call / inbound webhook here:
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
  const raw = await req.text();
  let from: string | null = null;
  try {
    const j = JSON.parse(raw) as { from?: string };
    from = j.from ?? null;
  } catch {
    const p = new URLSearchParams(raw);
    from = p.get("From") ?? p.get("CallFrom") ?? p.get("from");
  }
  const phone = normalizePhone(from);
  if (!phone) return NextResponse.json({ ok: true, action: "ignored" });
  // The most recent confirmed referral (last 24 h) where this number is the attendant's.
  const referralId = await ReferralRepository.latestConfirmedForAttendant(phone, addMinutes(now(), -24 * 60));
  if (!referralId) return NextResponse.json({ ok: true, action: "no_referral" });
  after(async () => {
    const r = await ReferralRepository.get(referralId);
    if (r) await CallService.dispatchFamilyCall(r, "missed_call");
  });
  return NextResponse.json({ ok: true, action: "family_call" });
}
