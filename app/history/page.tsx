import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader, ReferralStatusPill, SimBadge, Stat } from "@/components/ui";
import { mmss } from "@/lib/ui/display";
import { pageSession } from "@/lib/modules/auth/session.service";
import { ViewService } from "@/lib/modules/referral/view.service";

export const dynamic = "force-dynamic";

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export default async function HistoryPage() {
  const s = await pageSession();
  const rows = await ViewService.list(s.org, 200);
  const real = rows.filter((r) => !r.is_simulated);
  const realTtfas = real.map((r) => r.ttfa_seconds).filter((x): x is number => x !== null);
  const realTtfa = median(realTtfas);
  const confirmedTimes = real.map((r) => r.time_to_confirmed_seconds).filter((x): x is number => x !== null);
  const totalCalls = real.reduce((n, r) => n + r.calls_total, 0);

  return (
    <div>
      <PageHeader
        title="Referrals"
        description="Every referral with its time to first yes. Real calls only in the headline numbers; simulations are labelled."
        actions={<Link href="/" className="btn btn-primary"><Plus aria-hidden className="size-4" /> New referral</Link>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Median time to first yes" value={realTtfa !== null ? mmss(realTtfa) : "—"} hint={`${realTtfas.length} real referrals with a yes`} accent="green" />
        <Stat label="Median time to confirmed bed" value={median(confirmedTimes) !== null ? mmss(median(confirmedTimes)!) : "—"} hint={`${confirmedTimes.length} confirmed`} />
        <Stat label="Real referrals" value={real.length} hint={`${rows.length - real.length} simulated`} />
        <Stat label="Calls per referral" value={real.length ? (totalCalls / real.length).toFixed(1) : "—"} hint="availability, hold and release" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-medium text-zinc-500">
              <th className="px-5 py-3 font-medium">Referral</th>
              <th className="px-5 py-3 font-medium">Case</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">First yes</th>
              <th className="px-5 py-3 text-right font-medium">Bed confirmed</th>
              <th className="px-5 py-3 text-right font-medium">Calls</th>
              <th className="px-5 py-3 font-medium">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="group hover:bg-zinc-50/80">
                <td className="px-5 py-3">
                  <Link className="kbd-num font-medium text-zinc-900 group-hover:text-brand-700" href={`/referrals/${r.id}`}>{r.code}</Link>
                  {r.is_simulated && <span className="ml-2 align-middle"><SimBadge /></span>}
                </td>
                <td className="px-5 py-3 text-zinc-700">{r.case_label} <span className="text-zinc-400">· {r.acuity}</span></td>
                <td className="px-5 py-3"><ReferralStatusPill status={r.status} size="sm" /></td>
                <td className="kbd-num px-5 py-3 text-right text-zinc-900">{r.ttfa_seconds !== null ? mmss(r.ttfa_seconds) : "—"}</td>
                <td className="kbd-num px-5 py-3 text-right text-zinc-700">{r.time_to_confirmed_seconds !== null ? mmss(r.time_to_confirmed_seconds) : "—"}</td>
                <td className="kbd-num px-5 py-3 text-right text-zinc-700">{r.calls_total}</td>
                <td className="px-5 py-3 text-zinc-500">{new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="px-5 py-12 text-center text-zinc-500" colSpan={7}>No referrals yet. Start one from New referral or the Demo console.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
