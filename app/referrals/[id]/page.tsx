import { notFound } from "next/navigation";
import { LiveBoard } from "@/components/LiveBoard";
import { getReferralView } from "@/lib/view";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReferralBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const view = await getReferralView(id);
  if (!view) notFound();
  // Serialise dates the same way the API does, so server and client renders match.
  return <LiveBoard initial={JSON.parse(JSON.stringify(view))} />;
}
