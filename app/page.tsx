import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DraftsList } from "@/components/DraftsList";
import { ReferralForm } from "@/components/ReferralForm";
import { PageHeader, ReferralStatusPill, SimBadge } from "@/components/ui";
import { env } from "@/lib/core/config";
import { IntakeService } from "@/lib/modules/intake/intake.service";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { mmss } from "@/lib/ui/display";
import { pageSession } from "@/lib/modules/auth/session.service";
import { ViewService } from "@/lib/modules/referral/view.service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewReferralPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const s = await pageSession();
  const draftId = (await searchParams).draft;
  const [templates, capabilities, referrer, recent, drafts, draft] = await Promise.all([
    ReferralRepository.caseTemplates(),
    FacilityRepository.allCapabilities(),
    ReferralRepository.defaultReferrer(s.org, s.rid),
    ViewService.list(s.org, 6),
    IntakeService.list(s.org),
    draftId && UUID.test(draftId) ? IntakeService.get(s.org, draftId) : Promise.resolve(null),
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
      {!draft && <DraftsList initial={drafts} />}
      <ReferralForm
        key={draft?.id ?? "new"}
        draft={draft ? { id: draft.id, parsed: draft.parsed } : null}
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
