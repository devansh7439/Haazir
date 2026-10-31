import { NextResponse, after } from "next/server";
import { env } from "@/lib/core/config";
import { handleInbound, parseMetaPayload, parseTwilioPayload, verifyMetaSignature, verifyTwilioSignature, type InboundMessage } from "@/lib/modules/intake/inbound.service";
import { createLogger } from "@/lib/core/logger";

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
  const raw = await req.text();
  let messages: InboundMessage[] = [];
  const isTwilio = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  if (isTwilio) {
    const params = Object.fromEntries(new URLSearchParams(raw));
    const url = `${env.appBaseUrl.replace(/\/$/, "")}/api/whatsapp/inbound${new URL(req.url).search}`;
    if (!verifyTwilioSignature(url, params, req.headers.get("x-twilio-signature"), env.twilioToken)) {
      return new Response("unauthorized", { status: 401 });
    }
    messages = parseTwilioPayload(params);
  } else {
    if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), env.metaAppSecret)) {
      return new Response("unauthorized", { status: 401 });
    }
    try {
      messages = parseMetaPayload(JSON.parse(raw));
    } catch {
      messages = [];
    }
  }
  after(async () => {
    for (const m of messages) {
      try {
        await handleInbound(m);
      } catch (err) {
        log.error({ err }, "Inbound WhatsApp failed");
      }
    }
  });
  return isTwilio
    ? new Response("<Response/>", { status: 200, headers: { "Content-Type": "text/xml" } })
    : NextResponse.json({ ok: true });
}
