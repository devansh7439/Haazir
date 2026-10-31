import { TestMatrix } from "@/components/demo/TestMatrix";
import { pageSession } from "@/lib/modules/auth/session.service";
import { TestMatrixRepository } from "@/lib/modules/demo/test-matrix.repository";

export const dynamic = "force-dynamic";

export default async function TestMatrixPage() {
  const s = await pageSession();
  const entries = await TestMatrixRepository.list(s.org);
  return <TestMatrix initial={JSON.parse(JSON.stringify(entries))} />;
}
