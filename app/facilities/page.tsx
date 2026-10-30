import { FacilitiesAdmin } from "@/components/FacilitiesAdmin";
import { q } from "@/lib/db";
import { listFacilities } from "@/lib/directory";
import type { Capability } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const [facilities, capabilities] = await Promise.all([
    listFacilities(),
    q<Capability>(`select * from capabilities order by category, label`),
  ]);
  return <FacilitiesAdmin initial={JSON.parse(JSON.stringify(facilities))} capabilities={capabilities} />;
}
