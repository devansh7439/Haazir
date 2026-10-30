import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { assignNumbers } from "@/lib/demo";
import { AssignNumbersBody } from "@/lib/validation";

export async function POST(req: Request) {
  return handle(async () => NextResponse.json(await assignNumbers(await parseBody(req, AssignNumbersBody))));
}
