import { TestMatrix } from "@/components/TestMatrix";
import { q } from "@/lib/core/db";
import { pageSession } from "@/lib/modules/auth/session.service";
import type { MatrixEntry } from "@/lib/modules/demo/test-matrix.helper";

export const dynamic = "force-dynamic";

export default async function TestMatrixPage() {
  const s = await pageSession();
  const entries = await q<MatrixEntry>(
    `select pass, row_no, result, note, referral_code, tested_by, tested_at from test_matrix_results where org_id = $1`,
    [s.org],
  );
  return <TestMatrix initial={JSON.parse(JSON.stringify(entries))} />;
}
