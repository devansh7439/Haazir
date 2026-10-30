import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api";
import { setCapabilities } from "@/lib/directory";
import { CapabilitiesBody } from "@/lib/validation";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { codes } = await parseBody(req, CapabilitiesBody);
    return NextResponse.json({ codes: await setCapabilities((await params).id, codes) });
  });
}
