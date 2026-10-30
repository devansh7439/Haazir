import { functionRoute } from "@/lib/functionRoute";
import { handleRecordHold } from "@/lib/handlers";

export async function POST(req: Request) {
  return functionRoute(req, "record-hold", (params) => handleRecordHold(params));
}
