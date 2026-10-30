import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { resetDemo } from "@/lib/demo";

export async function POST() {
  return handle(async () => NextResponse.json(await resetDemo()));
}
