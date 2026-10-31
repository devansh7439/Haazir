import { FacilitiesAdmin } from "@/components/FacilitiesAdmin";
import { q } from "@/lib/core/db";
import { listFacilities } from "@/lib/modules/facility/directory.service";
import { pageSession } from "@/lib/modules/auth/session.service";
import type { Capability } from "@/lib/core/types";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const s = await pageSession();
  const [facilities, capabilities] = await Promise.all([
    listFacilities(s.org),
    q<Capability>(`select * from capabilities order by category, label`),
  ]);
  return <FacilitiesAdmin initial={JSON.parse(JSON.stringify(facilities))} capabilities={capabilities} canEdit={s.role === "admin"} />;
}
