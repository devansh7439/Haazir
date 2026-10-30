import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config";
import { addMinutes, now } from "@/lib/clock";
import { one } from "@/lib/db";
import { normalizePhone } from "@/lib/normalize";
import { dispatchFamilyCall } from "@/lib/orchestrator";
import { getReferral } from "@/lib/repo";

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
  const match = await one<{ referral_id: string }>(
    `select r.id as referral_id from patient_details pd join referrals r on r.id = pd.referral_id
     where pd.attendant_phone_e164 = $1 and r.status in ('confirmed', 'closed') and r.confirmed_at > $2
     order by r.confirmed_at desc limit 1`,
    [phone, addMinutes(now(), -24 * 60)],
  );
  if (!match) return NextResponse.json({ ok: true, action: "no_referral" });
  after(async () => {
    const r = await getReferral(match.referral_id);
    if (r) await dispatchFamilyCall(r, "missed_call");
  });
  return NextResponse.json({ ok: true, action: "family_call" });
}
