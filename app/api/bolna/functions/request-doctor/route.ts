import { functionRoute } from "@/lib/functionRoute";
import { handleRequestDoctor } from "@/lib/handlers";

export async function POST(req: Request) {
  return functionRoute(req, "request-doctor", (params) => handleRequestDoctor(params));
}
