import { NextResponse, after } from "next/server";
import { env } from "@/lib/core/config";
import { createLogger } from "@/lib/core/logger";
import { readInbound } from "@/lib/integrations/whatsapp/whatsapp.inbound";
import { InboundService } from "@/lib/modules/intake/inbound.service";

const log = createLogger("whatsapp");

// WhatsApp webhook (Meta Cloud API or Twilio). Signatures are checked; processing (which may transcribe a voice note)
// runs after the response so the provider doesn't retry.

// Meta's one-time webhook verification.
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && env.metaVerifyToken && u.searchParams.get("hub.verify_token") === env.metaVerifyToken) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const read = readInbound(
    { raw: await req.text(), contentType: req.headers.get("content-type") ?? "", url: req.url, headers: req.headers },
    { appBaseUrl: env.appBaseUrl, twilioToken: env.twilioToken, metaAppSecret: env.metaAppSecret },
  );
  if (!read.ok) return new Response("unauthorized", { status: 401 });
  after(async () => {
    for (const m of read.messages) {
      try {
        await InboundService.handle(m);
      } catch (err) {
        log.error({ err }, "Inbound WhatsApp failed");
      }
    }
  });
  return read.provider === "twilio"
    ? new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } })
    : NextResponse.json({ ok: true });
}
