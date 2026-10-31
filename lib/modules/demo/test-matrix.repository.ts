import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";
import type { MatrixEntry } from "@/lib/modules/demo/test-matrix.helper";

const COLUMNS = "pass, row_no, result, note, referral_code, tested_by, tested_at";

/** The voice test-matrix results (`test_matrix_results`): 20 scenarios × 2 passes per organisation. */
export const TestMatrixRepository = {
  list: (orgId: string): Promise<MatrixEntry[]> => q<MatrixEntry>(`select ${COLUMNS} from test_matrix_results where org_id = $1`, [orgId]),

  /** Records a result for one scenario and pass, replacing an earlier one. */
  upsert: (orgId: string, e: Omit<MatrixEntry, "tested_at">): Promise<MatrixEntry | null> =>
    one<MatrixEntry>(
      `insert into test_matrix_results (org_id, pass, row_no, result, note, referral_code, tested_by, tested_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (org_id, pass, row_no) do update set result = excluded.result, note = excluded.note,
         referral_code = excluded.referral_code, tested_by = excluded.tested_by, tested_at = excluded.tested_at
       returning ${COLUMNS}`,
      [orgId, e.pass, e.row_no, e.result, e.note, e.referral_code, e.tested_by, now()],
    ),
};
