import { functionRoute } from "@/lib/functionRoute";
import { handleRequestCallback } from "@/lib/handlers";

export async function POST(req: Request) {
  return functionRoute(req, "request-callback", (params) => handleRequestCallback(params));
}
