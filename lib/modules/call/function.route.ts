import "server-only";
import { NextResponse, after } from "next/server";
import { functionAuthorized } from "@/lib/integrations/bolna/bolna.auth";
import { createLogger } from "@/lib/core/logger";
import { WebhookLogRepository } from "@/lib/modules/call/webhook.repository";
import type { FunctionResult } from "@/lib/modules/call/call.type";

const log = createLogger("bolna-function");

// Shared wrapper for /api/bolna/functions/*. Bolna's LLM reads the JSON we return, so we always answer 200
// with an `instruction` — even on internal errors — so a call never breaks in front of a hospital.
// The database write that turns the board green happens before we respond; everything else runs after().

const SAFE = { result: "error", instruction: "Thank them for their help and end the call." };

export async function functionRoute(
  req: Request,
  name: string,
  handler: (params: Record<string, unknown>) => Promise<FunctionResult>,
): Promise<Response> {
  if (!functionAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let params: Record<string, unknown> = {};
  try {
    const body = await req.json();
    if (body && typeof body === "object") params = body as Record<string, unknown>;
  } catch {
    // Treat an unreadable body as empty; the handler falls back to a safe instruction.
  }
  try {
    await WebhookLogRepository.log(null, `function:${name}`, params);
    const res = await handler(params);
    after(async () => {
      try {
        await res.followUp();
      } catch (err) {
        log.error({ err, function: name }, "Follow-up failed");
      }
    });
    return NextResponse.json({ result: res.result, instruction: res.instruction });
  } catch (err) {
    log.error({ err, function: name }, "Failed");
    return NextResponse.json(SAFE);
  }
}
