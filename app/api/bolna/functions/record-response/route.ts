import { functionRoute } from "@/lib/functionRoute";
import { handleRecordResponse } from "@/lib/handlers";

export async function POST(req: Request) {
  return functionRoute(req, "record-response", (params) => handleRecordResponse(params));
}
