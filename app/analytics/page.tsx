import Link from "next/link";
import { HourChart } from "@/components/analytics/HourChart";
import { PageHeader, Stat, cx } from "@/components/ui";
import { AnalyticsService } from "@/lib/modules/analytics/analytics.service";
import { SessionService } from "@/lib/modules/auth/session.service";
import { clock, mmss, shortName } from "@/lib/ui/display";

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

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const s = await SessionService.page();
  const realOnly = (await searchParams).scope === "real";
  const [hospitals, hours, proof] = await Promise.all([
    AnalyticsService.hospitalStats(s.org),
    AnalyticsService.hourStats(s.org),
    AnalyticsService.proofStats(s.org, realOnly),
  ]);
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
      />
      <section aria-labelledby="proof-h" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="proof-h" className="text-sm font-semibold">Proof</h2>
          <div className="seg" role="group" aria-label="Which referrals">
            <Link href="/analytics" className={cx("seg-item", !realOnly && "seg-item-on")}>All referrals</Link>
            <Link href="/analytics?scope=real" className={cx("seg-item", realOnly && "seg-item-on")}>Real hospitals only</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="Median time to first yes"
            value={proof.median_ttfa_s === null ? "—" : mmss(proof.median_ttfa_s)}
            hint={`${proof.referrals} referrals, ${proof.placed} placed`}
            accent="brand"
          />
          <Stat
            label="Answer rate"
            value={proof.calls ? `${Math.round((100 * proof.answered) / proof.calls)}%` : "—"}
            hint={`${proof.answered} of ${proof.calls} availability calls`}
          />
          <Stat
            label="Answers flagged for review"
            value={proof.with_outcome ? `${Math.round((100 * proof.needs_review) / proof.with_outcome)}%` : "—"}
            hint={`${proof.needs_review} of ${proof.with_outcome} answered; the rest agreed with the post-call check`}
          />
          <Stat
            label="Bounce rate"
            value={proof.arrival_answers ? `${Math.round((100 * proof.not_arrived) / proof.arrival_answers)}%` : "—"}
            hint={proof.arrival_answers ? `${proof.not_arrived} of ${proof.arrival_answers} arrival checks said not arrived` : "no arrival checks answered yet"}
          />
          <Stat
            label="Cost per referral"
            value={proof.total_cost !== null && proof.referrals ? (proof.total_cost / proof.referrals).toFixed(2) : "—"}
            hint={proof.median_call_s === null ? "no call lengths yet" : `Bolna's units · median call ${mmss(proof.median_call_s)}`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat
            label="Median time to a confirmed bed"
            value={proof.median_to_bed_s === null ? "—" : mmss(proof.median_to_bed_s)}
            hint={`${proof.placed} placed`}
          />
          <Stat
            label="Median time to treatment"
            value={proof.median_to_treatment_s === null ? "—" : mmss(proof.median_to_treatment_s)}
            hint={proof.treated ? `from "Find a bed" to treatment starting, ${proof.treated} recorded` : "no treatment start recorded yet"}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Time and answer figures are measured from recorded calls. Outcome accuracy is not here: it needs a person to compare each answer with its recording.
        </p>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Availability calls" value={calls} hint={`to ${hospitals.filter((h) => h.calls > 0).length} hospitals`} />
        <Stat
          label="Answer rate"
          value={answerRate === null ? "—" : `${Math.round(answerRate)}%`}
          hint={`${answered} answered`}
          accent="brand"
        />
        <Stat
          label="Acceptance rate"
          value={acceptRate === null ? "—" : `${Math.round(acceptRate)}%`}
          hint={`${accepted} of ${answered} answered calls`}
          accent="green"
        />
        <Stat
          label="Portal vs desk mismatches"
          value={mismatches}
          hint={medians.length ? `median answer in ${mmss(medians[Math.floor(medians.length / 2)])}` : "no answers yet"}
        />
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
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-zinc-500">
                <th className="px-5 py-3 font-medium">Hospital</th>
                <th className="px-5 py-3 text-right font-medium">Calls</th>
                <th className="px-5 py-3 font-medium">Answered</th>
                <th className="px-5 py-3 font-medium">Accepted (of answered)</th>
                <th className="px-5 py-3 text-right font-medium">Median time to answer</th>
                <th className="px-5 py-3 text-right font-medium">Portal mismatches</th>
                <th className="px-5 py-3 font-medium">Not arrived (of checks)</th>
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
                  <td className="px-5 py-3"><RateBar n={h.not_arrived} d={h.arrival_answers} /></td>
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
