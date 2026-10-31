import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/core/route";
import { requireSession } from "@/lib/modules/auth/session.service";
import { TestMatrixBody } from "@/lib/modules/demo/demo.validation";
import { TestMatrixRepository } from "@/lib/modules/demo/test-matrix.repository";

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    const entries = await TestMatrixRepository.list(s.org);
    return NextResponse.json({ entries });
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const b = await parseBody(req, TestMatrixBody);
    const entry = await TestMatrixRepository.upsert(s.org, { ...b, tested_by: b.tested_by ?? s.name });
    return NextResponse.json(entry);
  });
}
