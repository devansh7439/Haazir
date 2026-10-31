import { NextResponse, after } from "next/server";
import { webhookAuthorized } from "@/lib/bolnaAuth";
import { createLogger } from "@/lib/core/logger";
import { WebhookService } from "@/lib/modules/call/webhook.service";

const log = createLogger("bolna-webhook");

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
    const res = await WebhookService.handle(body);
    after(async () => {
      try {
        await res.followUp();
      } catch (err) {
        log.error({ err }, "Webhook follow-up failed");
      }
    });
  } catch (err) {
    log.error({ err }, "Webhook failed");
  }
  return NextResponse.json({ ok: true });
}
