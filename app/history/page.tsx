import Link from "next/link";
import { REFERRAL_STATUS, mmss } from "@/lib/ui";
import { listReferrals } from "@/lib/view";

export const dynamic = "force-dynamic";

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export default async function HistoryPage() {
  const rows = await listReferrals(200);
  const real = rows.filter((r) => !r.is_simulated);
  const realTtfa = median(real.map((r) => r.ttfa_seconds).filter((x): x is number => x !== null));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-6">
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-slate-700">
          Median time to first yes on real calls: <strong className="font-mono text-xl">{realTtfa !== null ? mmss(realTtfa) : "—"}</strong>{" "}
          <span className="text-sm text-slate-500">({real.filter((r) => r.ttfa_seconds !== null).length} real referrals with a yes; simulations excluded)</span>
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Case</th>
              <th className="p-3">Status</th>
              <th className="p-3">First yes (TTFA)</th>
              <th className="p-3">Time to confirmed bed</th>
              <th className="p-3">Calls</th>
              <th className="p-3">Started</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="p-3 font-mono font-bold">
                  <Link className="text-blue-800 underline" href={`/referrals/${r.id}`}>{r.code}</Link>
                  {r.is_simulated && <span className="ml-2 rounded bg-yellow-300 px-1.5 py-0.5 font-sans text-[10px] font-bold text-yellow-950">SIM</span>}
                </td>
                <td className="p-3">{r.case_label} · {r.acuity}</td>
                <td className="p-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${REFERRAL_STATUS[r.status]?.className}`}>{REFERRAL_STATUS[r.status]?.text ?? r.status}</span>
                </td>
                <td className="p-3 font-mono">{r.ttfa_seconds !== null ? mmss(r.ttfa_seconds) : "—"}</td>
                <td className="p-3 font-mono">{r.time_to_confirmed_seconds !== null ? mmss(r.time_to_confirmed_seconds) : "—"}</td>
                <td className="p-3">{r.calls_total}</td>
                <td className="p-3 text-slate-600">{new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="p-6 text-slate-600" colSpan={7}>No referrals yet. Run one from New referral or the Demo page.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
