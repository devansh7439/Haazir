import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/core/config";
import { createLogger } from "@/lib/core/logger";
import { declineXml, dialXml } from "@/lib/modules/call/bridge.helper";
import { BridgeService } from "@/lib/modules/call/bridge.service";

const log = createLogger("bridge");

// Answer URL of the bridge number (docs/05-voice-agents.md §7). The provider asks where to send the call; we answer with
// XML that rings the referring doctor. Auth: ?token=<BRIDGE_SECRET>. Always XML, so a caller never hears a server error.

const authorized = (req: Request): boolean => {
  const secret = env.bridgeSecret;
  if (!secret) return false;
  const a = Buffer.from(new URL(req.url).searchParams.get("token") ?? "");
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

const xml = (body: string) => new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });

async function answer(req: Request): Promise<Response> {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  try {
    let from = new URL(req.url).searchParams.get("From");
    if (req.method === "POST") {
      const form = await req.formData().catch(() => null);
      from = (form?.get("From") as string | null) ?? from;
    }
    const doctor = await BridgeService.doctorFor(from);
    return xml(doctor ? dialXml(doctor) : declineXml());
  } catch (err) {
    log.error({ err }, "Bridge answer failed");
    return xml(declineXml());
  }
}

export const GET = answer;
export const POST = answer;
