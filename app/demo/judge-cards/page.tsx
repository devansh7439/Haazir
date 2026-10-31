import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader } from "@/components/ui";
import { DemoService } from "@/lib/modules/demo/demo.service";
import { JUDGE_CARDS } from "@/lib/modules/demo/judge-cards.helper";
import { pageSession } from "@/lib/modules/auth/session.service";
import { shortName } from "@/lib/ui/display";

export const dynamic = "force-dynamic";

// Printable judge cards (docs/08-demo-and-pitch.md §2), with each phone's assigned number so cards and phones match.
export default async function JudgeCardsPage() {
  await pageSession({ demo: true });
  const status = await DemoService.status();
  const byId = new Map(status.facilities.map((f) => [f.facility_id, f]));
  const placeholder = (p: string | null) => !p || /^\+9100000/.test(p);
  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Judge cards"
          description="Print one per phone and put the matching numbered sticker on each phone. Numbers come from the Demo console."
          actions={<><Link href="/demo" className="btn btn-secondary">Back to demo console</Link><PrintButton /></>}
        />
        {JUDGE_CARDS.some((c) => placeholder(byId.get(c.facility_id)?.phone ?? null)) && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            Some cards still show placeholder numbers. Assign real phones on the Demo console first.
          </p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
        {JUDGE_CARDS.map((c) => {
          const f = byId.get(c.facility_id);
          return (
            <article key={c.card} className="card break-inside-avoid p-5 print:rounded-lg print:shadow-none">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white print:bg-black">{c.card}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-tight">{shortName(f?.name ?? "")}</h2>
                  <p className="text-sm text-zinc-500">{c.role} · {c.language}</p>
                  <p className={`kbd-num mt-1 text-sm ${placeholder(f?.phone ?? null) ? "text-amber-700" : "text-zinc-700"}`}>Phone: {f?.phone ?? "not assigned"}</p>
                </div>
              </div>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
                {c.lines.map((l) => <li key={l}>{l}</li>)}
              </ol>
            </article>
          );
        })}
        <article className="card break-inside-avoid p-5 print:shadow-none">
          <h2 className="text-lg font-semibold">Doctor phone (presenter)</h2>
          <p className="kbd-num text-sm text-zinc-700">Phone: {status.referrer_phone ?? "not assigned"}</p>
          <p className="mt-3 text-[15px]">Receives the confirmation WhatsApp. Calls card 4 back from the banner.</p>
        </article>
        <article className="card break-inside-avoid p-5 print:shadow-none">
          <h2 className="text-lg font-semibold">Family phone (volunteer)</h2>
          <p className="kbd-num text-sm text-zinc-700">Phone: {status.family_phone ?? "not assigned"}</p>
          <p className="mt-3 text-[15px]">Receives the Kannada WhatsApp message, and the family update call.</p>
        </article>
      </div>
    </div>
  );
}
