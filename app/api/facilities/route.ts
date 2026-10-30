import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { createFacility, listFacilities } from "@/lib/directory";
import { FacilityCreateBody } from "@/lib/validation";

export async function GET() {
  return handle(async () => NextResponse.json({ facilities: await listFacilities() }));
}

export async function POST(req: Request) {
  return handle(async () => NextResponse.json(await createFacility(await parseBody(req, FacilityCreateBody)), { status: 201 }));
}
