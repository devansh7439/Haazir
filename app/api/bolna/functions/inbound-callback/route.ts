import { functionRoute } from "@/lib/functionRoute";
import { handleInboundCallback } from "@/lib/handlers";

export async function POST(req: Request) {
  return functionRoute(req, "inbound-callback", (params) => handleInboundCallback(params));
}
