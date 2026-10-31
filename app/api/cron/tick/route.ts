import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/core/config";
import { MaintenanceService } from "@/lib/modules/maintenance/maintenance.service";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("cron");

// Background tick for every active referral. Call it every minute from Supabase pg_cron (supabase/cron.sql)
// or any scheduler. Auth: Authorization: Bearer <CRON_SECRET> or ?token=.
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = env.cronSecret;
  if (!secret) return false;
  const header = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const token = header || new URL(req.url).searchParams.get("token") || "";
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await MaintenanceService.tick()) });
  } catch (err) {
    log.error({ err }, "Cron tick failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
