import { Phone, RotateCw, X } from "lucide-react";
import { attemptDisplay, shortName } from "@/lib/ui/display";
import type { AttemptView, ReferralView } from "@/lib/modules/referral/view.type";

export function ExhaustedPanel({ view, cards, onWiden }: { view: ReferralView; cards: AttemptView[]; onWiden: () => void }) {
  const calls = view.attempts.filter((a) => a.purpose === "availability").length;
  return (
    <section className="card overflow-hidden" aria-labelledby="ex-h">
      <div className="flex items-start gap-3 border-b border-line bg-rose-50/60 px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600"><X aria-hidden className="size-5" /></span>
        <div>
          <h2 id="ex-h" className="text-[15px] font-semibold text-rose-950">
            No hospital accepted after {view.referral.current_wave} round{view.referral.current_wave === 1 ? "" : "s"} ({calls} calls)
          </h2>
          <p className="mt-0.5 text-sm text-rose-900/80">Call these desks directly, or widen the search.</p>
        </div>
      </div>
      <ol className="divide-y divide-line">
        {[...cards].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="grid size-6 place-items-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{a.rank}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{shortName(a.facility_name)}</div>
              <div className="text-xs text-zinc-500">{a.eta_minutes} min · last answer: {attemptDisplay(a, Date.now()).text}</div>
            </div>
            <a className="btn btn-secondary" href={`tel:${a.to_number}`}><Phone aria-hidden className="size-4" /> {a.to_number}</a>
          </li>
        ))}
      </ol>
      <div className="border-t border-line px-5 py-3">
        <button className="btn btn-primary" onClick={onWiden}><RotateCw aria-hidden className="size-4" /> Widen to 80 km and try again</button>
      </div>
    </section>
  );
}
