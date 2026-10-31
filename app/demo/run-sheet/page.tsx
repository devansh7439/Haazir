import Link from "next/link";
import { Rich } from "@/components/Rich";
import { PageHeader, Stat } from "@/components/ui";
import { fillPlaceholders, tableUnder } from "@/lib/modules/demo/pitch.helper";
import { PitchService } from "@/lib/modules/demo/pitch.service";
import { pageSession } from "@/lib/modules/auth/session.service";

export const dynamic = "force-dynamic";

export default async function RunSheetPage() {
  const s = await pageSession({ demo: true });
  const md = PitchService.readDoc();
  const m = await PitchService.measured(s.org);
  const script = tableUnder(md, "The 3-minute script");
  const fallback = tableUnder(md, "Fallback ladder");
  const questions = tableUnder(md, "Hard questions");
  const fill = (t: string) => fillPlaceholders(t, m);

  return (
    <div className="print:text-[11px]">
      <PageHeader
        title="Run sheet"
        description="The 3-minute script, fallback ladder and hard questions from docs/08, with your measured numbers filled in. Amber means not measured yet: don't say it."
        actions={<Link href="/demo" className="btn btn-secondary print:hidden">Back to demo console</Link>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Last real time to first yes" value={m.ttfa ?? "—"} hint="{TTFA} in the script" accent="green" />
        <Stat label="Real referrals with a yes" value={m.n} hint="{N}" />
        <Stat label="Median time to first yes" value={m.median ?? "—"} hint="{X}" />
        <Stat label="Answer rate, real calls" value={m.answerRate ?? "—"} hint="{answer rate}" />
      </div>

      {script && (
        <section className="card mb-6 overflow-hidden" aria-labelledby="script-h">
          <h2 id="script-h" className="border-b border-line px-5 py-3.5 text-sm font-semibold">The 3-minute script</h2>
          <ol className="divide-y divide-line">
            {script.rows.map(([time, screen, say]) => (
              <li key={time} className="grid gap-2 px-5 py-3.5 text-sm sm:grid-cols-[90px_220px_minmax(0,1fr)]">
                <span className="kbd-num font-semibold text-brand-700">{time}</span>
                <span className="text-zinc-500"><Rich text={fill(screen)} /></span>
                <span className="leading-relaxed text-zinc-800"><Rich text={fill(say)} /></span>
              </li>
            ))}
          </ol>
          <p className="border-t border-line bg-zinc-50 px-5 py-3 text-xs text-zinc-600">
            If a phone doesn&apos;t ring, keep going: &ldquo;that&apos;s what a no-answer looks like, and it&apos;s why we call six.&rdquo;
          </p>
        </section>
      )}

      {fallback && (
        <section className="card mb-6 overflow-hidden" aria-labelledby="fb-h">
          <h2 id="fb-h" className="border-b border-line px-5 py-3.5 text-sm font-semibold">Fallback ladder</h2>
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-line text-xs text-zinc-500">{fallback.header.map((h) => <th key={h} className="px-5 py-2.5 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {fallback.rows.map((r) => (
                <tr key={r[0]}>{r.map((c, i) => <td key={i} className="px-5 py-2.5 align-top"><Rich text={fill(c)} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {questions && (
        <section className="card overflow-hidden" aria-labelledby="q-h">
          <h2 id="q-h" className="border-b border-line px-5 py-3.5 text-sm font-semibold">Hard questions ({questions.rows.length}) · rehearse these</h2>
          <div className="divide-y divide-line">
            {questions.rows.map(([no, q, a]) => (
              <details key={no} className="group px-5 py-3 text-sm print:open">
                <summary className="cursor-pointer list-none font-medium text-zinc-900">
                  <span className="kbd-num mr-2 text-zinc-400">{no}</span><Rich text={q} />
                </summary>
                <p className="mt-2 leading-relaxed text-zinc-700"><Rich text={fill(a)} /></p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
