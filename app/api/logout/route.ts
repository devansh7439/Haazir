import { NextResponse } from "next/server";
import { GATE_COOKIE, SESSION_COOKIE } from "@/lib/modules/auth/gate.helper";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(GATE_COOKIE);
  return res;
}
