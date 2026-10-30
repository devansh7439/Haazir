import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ReferralForm } from "@/components/ReferralForm";
import { PageHeader, ReferralStatusPill, SimBadge } from "@/components/ui";
import { env } from "@/lib/config";
import { one, q } from "@/lib/db";
import type { Capability, CaseTemplate } from "@/lib/types";
import { mmss } from "@/lib/ui";
import { listReferrals } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function NewReferralPage() {
  const [templates, capabilities, referrer, recent] = await Promise.all([
    q<CaseTemplate>(`select * from case_templates order by case when case_type = 'other' then 1 else 0 end, label`),
    q<Capability>(`select * from capabilities order by category, label`),
    one<{ id: string }>(`select id from referrers order by created_at limit 1`),
    listReferrals(6),
  ]);
  const bolnaReady = !!env.bolnaApiKey && !!env.agentId("availability");

  if (!referrer) {
    return <p className="card p-6">No referring doctor is set up. Run the seed (see README).</p>;
  }

  return (
    <div>
      <PageHeader
        title="New referral"
        description="Haazir phones every capable hospital nearby at once, in their language, and shows you who says yes."
      />
      <ReferralForm
        referrerId={referrer.id}
        templates={templates}
        capabilities={capabilities}
        defaultSimulate={env.simulationMode || !bolnaReady}
        bolnaReady={bolnaReady && !env.simulationMode}
      />
      {recent.length > 0 && (
        <section aria-labelledby="recent-h" className="card mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 id="recent-h" className="text-sm font-semibold">Recent referrals</h2>
            <Link href="/history" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
              View all <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/referrals/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-zinc-50">
                  <span className="kbd-num w-16 font-medium text-zinc-900">{r.code}</span>
                  <span className="min-w-40 flex-1 text-zinc-700">{r.case_label}</span>
                  <ReferralStatusPill status={r.status} size="sm" />
                  <span className="kbd-num w-24 text-right text-zinc-500">{r.ttfa_seconds !== null ? `yes in ${mmss(r.ttfa_seconds)}` : "—"}</span>
                  {r.is_simulated && <SimBadge />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
