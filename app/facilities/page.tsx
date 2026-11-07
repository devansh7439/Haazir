import { EscalationSection } from "@/components/facilities/EscalationSection";
import { FacilitiesAdmin } from "@/components/facilities/FacilitiesAdmin";
import { EscalationService } from "@/lib/modules/escalation/escalation.service";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { SessionService } from "@/lib/modules/auth/session.service";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const s = await SessionService.page();
  const [facilities, capabilities] = await Promise.all([
    DirectoryService.list(s.org),
    FacilityRepository.allCapabilities(),
  ]);
  return (
    <>
      <FacilitiesAdmin initial={JSON.parse(JSON.stringify(facilities))} capabilities={capabilities} canEdit={s.role === "admin"} />
      {s.role === "admin" && <EscalationSection initial={await EscalationService.list(s.org)} />}
    </>
  );
}
