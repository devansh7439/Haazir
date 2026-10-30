import Link from "next/link";
import { ReferralForm } from "@/components/ReferralForm";
import { env } from "@/lib/config";
import { one, q } from "@/lib/db";
import type { Capability, CaseTemplate } from "@/lib/types";
import { REFERRAL_STATUS, mmss } from "@/lib/ui";
import { listReferrals } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function NewReferralPage() {
  const [templates, capabilities, referrer, recent] = await Promise.all([
    q<CaseTemplate>(`select * from case_templates order by case when case_type = 'other' then 1 else 0 end, label`),
    q<Capability>(`select * from capabilities order by category, label`),
    one<{ id: string; name: string; facility_name: string | null }>(
      `select r.id, r.name, f.name as facility_name from referrers r left join facilities f on f.id = r.facility_id
       order by r.created_at limit 1`,
    ),
    listReferrals(8),
  ]);
  const bolnaReady = !!env.bolnaApiKey && !!env.agentId("availability");

  if (!referrer) {
    return <p className="card p-6">No referring doctor is set up. Run the seed (see README).</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        {referrer.name.replace(" (Demo)", "")}
        {referrer.facility_name ? `, ${referrer.facility_name.replace(" (Demo)", "")}` : ""}
      </p>
      <ReferralForm
        referrerId={referrer.id}
        templates={templates}
        capabilities={capabilities}
        defaultSimulate={env.simulationMode || !bolnaReady}
        bolnaReady={bolnaReady && !env.simulationMode}
      />
      {recent.length > 0 && (
        <section aria-labelledby="recent-h" className="card p-4">
          <h2 id="recent-h" className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Recent referrals</h2>
          <ul className="divide-y divide-slate-100">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/referrals/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:bg-slate-50">
                  <span className="font-mono font-bold">{r.code}</span>
                  <span>{r.case_label}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${REFERRAL_STATUS[r.status]?.className}`}>
                    {REFERRAL_STATUS[r.status]?.text ?? r.status}
                  </span>
                  {r.ttfa_seconds !== null && <span className="text-sm text-slate-600">First yes {mmss(r.ttfa_seconds)}</span>}
                  {r.is_simulated && <span className="rounded bg-yellow-300 px-2 py-0.5 text-xs font-bold text-yellow-950">SIMULATED</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
