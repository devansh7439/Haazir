import { notFound } from "next/navigation";
import { LiveBoard } from "@/components/board/LiveBoard";
import { AttachmentsPanel } from "@/components/board/AttachmentsPanel";
import { TreatmentPanel } from "@/components/board/TreatmentPanel";
import { AmbulancePanel } from "@/components/board/AmbulancePanel";
import { SlipPanel } from "@/components/board/SlipPanel";
import { AttachmentService } from "@/lib/modules/attachment/attachment.service";
import { pageSession } from "@/lib/modules/auth/session.service";
import { ViewService } from "@/lib/modules/referral/view.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReferralBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const s = await pageSession();
  const r = await ReferralRepository.get(id);
  if (!r || r.org_id !== s.org) notFound();
  const [view, attachments] = await Promise.all([ViewService.get(id), AttachmentService.list(id)]);
  if (!view) notFound();
  // Serialise dates the same way the API does, so server and client renders match.
  return (
    <>
      <LiveBoard initial={JSON.parse(JSON.stringify(view))} />
      <AmbulancePanel referralId={r.id} status={r.ambulance_status} />
      <TreatmentPanel referralId={r.id} startedAt={r.treatment_started_at ? new Date(r.treatment_started_at).toISOString() : null} />
      <AttachmentsPanel referralId={r.id} initial={JSON.parse(JSON.stringify(attachments))} />
      <SlipPanel referralId={r.id} consent={r.transfer_consent} />
    </>
  );
}
