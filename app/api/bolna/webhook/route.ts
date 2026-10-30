import { NextResponse, after } from "next/server";
import { webhookAuthorized } from "@/lib/bolnaAuth";
import { handleWebhook } from "@/lib/handlers";

// Bolna status webhook (docs/04-api-spec.md §3.1). Statuses can arrive late or twice; the handler only
// moves attempts forward. Respond quickly and never throw on bad payloads.
export async function POST(req: Request) {
  if (!webhookAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "invalid json" });
  }
  try {
    const res = await handleWebhook(body);
    after(async () => {
      try {
        await res.followUp();
      } catch (err) {
        console.error("[haazir] webhook follow-up failed", err instanceof Error ? err.message : err);
      }
    });
  } catch (err) {
    console.error("[haazir] webhook failed", err instanceof Error ? err.message : err);
  }
  return NextResponse.json({ ok: true });
}
