import { FacilitiesAdmin } from "@/components/FacilitiesAdmin";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { pageSession } from "@/lib/modules/auth/session.service";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const s = await pageSession();
  const [facilities, capabilities] = await Promise.all([
    DirectoryService.list(s.org),
    FacilityRepository.allCapabilities(),
  ]);
  return <FacilitiesAdmin initial={JSON.parse(JSON.stringify(facilities))} capabilities={capabilities} canEdit={s.role === "admin"} />;
}
