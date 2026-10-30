import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { demoStatus } from "@/lib/demo";

export async function GET() {
  return handle(async () => NextResponse.json(await demoStatus()));
}
