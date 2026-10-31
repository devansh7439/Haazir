import { functionRoute } from "@/lib/modules/call/function.route";
import { FunctionService } from "@/lib/modules/call/function.service";

export async function POST(req: Request) {
  return functionRoute(req, "request-doctor", (params) => FunctionService.requestDoctor(params));
}
