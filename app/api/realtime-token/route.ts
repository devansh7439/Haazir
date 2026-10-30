import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { handle } from "@/lib/core/route";
import { env } from "@/lib/core/config";
import { requireSession } from "@/lib/session";

// Short-lived Supabase JWT carrying the caller's org_id, so Realtime only delivers rows the org-scoped RLS
// policies allow (supabase/migrations/0003). Without SUPABASE_JWT_SECRET the board falls back to polling.
const TTL_S = 3600;

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    if (!env.supabaseJwtSecret) return NextResponse.json({ token: null });
    const token = await new SignJWT({ role: "authenticated", org_id: s.org })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(s.uid ?? "console")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime(`${TTL_S}s`)
      .sign(new TextEncoder().encode(env.supabaseJwtSecret));
    return NextResponse.json({ token, expires_in: TTL_S });
  });
}
