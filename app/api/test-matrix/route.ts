import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, parseBody } from "@/lib/core/route";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import { requireSession } from "@/lib/session";
import type { MatrixEntry } from "@/lib/testMatrix";

const Body = z.object({
  pass: z.union([z.literal(1), z.literal(2)]),
  row_no: z.number().int().min(1).max(20),
  result: z.enum(["pass", "fail", "untested"]),
  note: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  referral_code: z.string().trim().max(12).optional().nullable().transform((v) => v || null),
  tested_by: z.string().trim().max(80).optional().nullable().transform((v) => v || null),
});

export async function GET() {
  return handle(async () => {
    const s = await requireSession();
    const entries = await q<MatrixEntry>(
      `select pass, row_no, result, note, referral_code, tested_by, tested_at from test_matrix_results where org_id = $1`,
      [s.org],
    );
    return NextResponse.json({ entries });
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const b = await parseBody(req, Body);
    const entry = await one<MatrixEntry>(
      `insert into test_matrix_results (org_id, pass, row_no, result, note, referral_code, tested_by, tested_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (org_id, pass, row_no) do update set result = excluded.result, note = excluded.note,
         referral_code = excluded.referral_code, tested_by = excluded.tested_by, tested_at = excluded.tested_at
       returning pass, row_no, result, note, referral_code, tested_by, tested_at`,
      [s.org, b.pass, b.row_no, b.result, b.note, b.referral_code, b.tested_by ?? s.name, now()],
    );
    return NextResponse.json(entry);
  });
}
