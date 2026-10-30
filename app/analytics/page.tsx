import Link from "next/link";
import { HourChart } from "@/components/HourChart";
import { PageHeader, Stat, cx } from "@/components/ui";
import { hospitalStats, hourStats } from "@/lib/analytics";
import { pageSession } from "@/lib/session";
import { clock, mmss, shortName } from "@/lib/ui";

export const dynamic = "force-dynamic";

function pct(n: number, d: number): number | null {
  return d === 0 ? null : (100 * n) / d;
}

function RateBar({ n, d }: { n: number; d: number }) {
  const p = pct(n, d);
  if (p === null) return <span className="text-zinc-400">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${p}%` }} />
      </div>
      <span className="kbd-num text-xs text-zinc-700">{Math.round(p)}% <span className="text-zinc-400">({n}/{d})</span></span>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  const s = await pageSession();
  const includeSim = (await searchParams).sim === "1";
  const [hospitals, hours] = await Promise.all([hospitalStats(s.org, includeSim), hourStats(s.org, includeSim)]);
  const calls = hospitals.reduce((n, h) => n + h.calls, 0);
  const answered = hospitals.reduce((n, h) => n + h.answered, 0);
  const accepted = hospitals.reduce((n, h) => n + h.accepted, 0);
  const medians = hospitals.map((h) => h.median_answer_s).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const mismatches = hospitals.reduce((n, h) => n + h.mismatches, 0);
  const answerRate = pct(answered, calls);
  const acceptRate = pct(accepted, answered);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Which desks answer, which accept, and when. Built from every recorded call, so it improves the ranking over time."
        actions={
          <div className="flex rounded-lg bg-zinc-100 p-1 text-sm" role="group" aria-label="Data shown">
            <Link href="/analytics" aria-current={!includeSim ? "true" : undefined} className={cx("rounded-md px-3 py-1.5 font-medium", !includeSim ? "bg-white shadow-sm" : "text-zinc-600")}>Real calls</Link>
            <Link href="/analytics?sim=1" aria-current={includeSim ? "true" : undefined} className={cx("rounded-md px-3 py-1.5 font-medium", includeSim ? "bg-white shadow-sm" : "text-zinc-600")}>Include simulated</Link>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Availability calls" value={calls} hint={includeSim ? "including simulations" : "real calls only"} />
        <Stat label="Answer rate" value={answerRate === null ? "—" : `${Math.round(answerRate)}%`} hint={`${answered} answered`} accent="brand" />
        <Stat label="Acceptance rate" value={acceptRate === null ? "—" : `${Math.round(acceptRate)}%`} hint={`${accepted} of ${answered} answered calls`} accent="green" />
        <Stat label="Portal vs desk mismatches" value={mismatches} hint={medians.length ? `median answer in ${mmss(medians[Math.floor(medians.length / 2)])}` : "no answers yet"} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <HourChart
          title="Calls placed"
          unit="count"
          bars={hours.map((h) => ({ hour: h.hour, value: h.calls || null, label: `${h.calls} calls, ${h.answered} answered` }))}
        />
        <HourChart
          title="Acceptance rate"
          unit="percent"
          max={100}
          bars={hours.map((h) => ({
            hour: h.hour,
            value: h.answered ? (100 * h.accepted) / h.answered : null,
            label: h.answered ? `${h.accepted} of ${h.answered} answered calls accepted` : "no answered calls",
          }))}
        />
      </div>

      <section className="card overflow-hidden" aria-labelledby="per-h">
        <div className="border-b border-line px-5 py-3.5">
          <h2 id="per-h" className="text-sm font-semibold">Per hospital</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-zinc-500">
                <th className="px-5 py-3 font-medium">Hospital</th>
                <th className="px-5 py-3 text-right font-medium">Calls</th>
                <th className="px-5 py-3 font-medium">Answered</th>
                <th className="px-5 py-3 font-medium">Accepted (of answered)</th>
                <th className="px-5 py-3 text-right font-medium">Median time to answer</th>
                <th className="px-5 py-3 text-right font-medium">Portal mismatches</th>
                <th className="px-5 py-3 font-medium">Last called</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {hospitals.map((h) => (
                <tr key={h.facility_id} className={cx(h.calls === 0 && "text-zinc-400")}>
                  <td className="px-5 py-3 font-medium text-zinc-900">{shortName(h.name)}</td>
                  <td className="kbd-num px-5 py-3 text-right">{h.calls}</td>
                  <td className="px-5 py-3"><RateBar n={h.answered} d={h.calls} /></td>
                  <td className="px-5 py-3"><RateBar n={h.accepted} d={h.answered} /></td>
                  <td className="kbd-num px-5 py-3 text-right">{h.median_answer_s !== null ? mmss(h.median_answer_s) : "—"}</td>
                  <td className={cx("kbd-num px-5 py-3 text-right", h.mismatches > 0 && "font-semibold text-amber-700")}>{h.mismatches}</td>
                  <td className="px-5 py-3 text-zinc-500">{h.last_called_at ? clock(h.last_called_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
