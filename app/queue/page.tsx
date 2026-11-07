import { Plus } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/queue/AutoRefresh";
import { QueueRow } from "@/components/queue/QueueRow";
import { PageHeader, Stat } from "@/components/ui";
import { now } from "@/lib/core/clock";
import { TICK_INTERVAL_MS } from "@/lib/core/config";
import { SessionService } from "@/lib/modules/auth/session.service";
import { attentionOf } from "@/lib/modules/referral/queue.helper";
import { ViewService } from "@/lib/modules/referral/view.service";

export const dynamic = "force-dynamic";

/** Every live referral of the organisation on one screen, the ones that need a person first. */
export default async function QueuePage() {
  const s = await SessionService.page();
  const rows = await ViewService.queue(s.org);
  const at = now().getTime();
  const needYou = rows.filter((r) => attentionOf(r) !== null).length;
  const callsOpen = rows.reduce((n, r) => n + r.calls_open, 0);

  return (
    <div>
      <AutoRefresh everyMs={TICK_INTERVAL_MS} />
      <PageHeader
        title="Queue"
        description="Live referrals, the ones that need you first."
        actions={<Link href="/" className="btn btn-primary"><Plus aria-hidden className="size-4" /> New referral</Link>}
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Live referrals" value={rows.length} />
        <Stat label="Need you" value={needYou} accent={needYou > 0 ? "brand" : undefined} hint="a decision, a callback or a recording" />
        <Stat label="Calls in progress" value={callsOpen} hint="across all referrals" />
      </div>
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">Nothing live right now. New referrals appear here as they start.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <QueueRow key={r.id} item={r} waitingSeconds={Math.max(0, (at - Date.parse(r.created_at)) / 1000)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
