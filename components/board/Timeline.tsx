import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { eventText, mmss } from "@/lib/ui/display";
import type { ReferralView } from "@/lib/modules/referral/view.type";
import { cx } from "@/components/ui";

export function Timeline({ view, facilityName }: { view: ReferralView; facilityName: (id: unknown) => string }) {
  const [expanded, setExpanded] = useState(false);
  const start = new Date(view.referral.created_at).getTime();
  const items = view.events
    .map((e) => ({ e, text: eventText({ type: e.type, payload: e.payload as Record<string, unknown> }, facilityName) }))
    .filter((x) => x.text);
  const shown = expanded ? items : items.slice(-12);
  const dot = (type: string) =>
    type === "options_ready" || type === "hold_confirmed" ? "bg-emerald-500"
      : type === "outcome_recorded" ? "bg-brand-500"
        : type === "alert" || type === "needs_review" ? "bg-amber-500"
          : type === "doctor_callback_requested" || type === "inbound_callback" ? "bg-violet-500"
            : "bg-zinc-300";
  return (
    <section className="card overflow-hidden" aria-labelledby="tl-h">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="tl-h" className="text-sm font-semibold">Activity</h2>
      </div>
      <ol className="relative px-5 py-4">
        <span aria-hidden className="absolute bottom-6 left-[5.35rem] top-6 w-px bg-line" />
        {shown.map(({ e, text }) => (
          <li key={e.id} className="relative flex items-start gap-4 py-1.5 text-sm">
            <span className="kbd-num w-12 shrink-0 pt-px text-right text-xs text-zinc-400">{mmss((new Date(e.created_at).getTime() - start) / 1000)}</span>
            <span aria-hidden className={cx("relative z-10 mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-white", dot(e.type))} />
            <span className="text-zinc-700">{text}</span>
          </li>
        ))}
      </ol>
      {items.length > 12 && (
        <button className="flex w-full items-center justify-center gap-1 border-t border-line py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50" onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Show latest only" : `Show all ${items.length} events`}
          <ChevronDown aria-hidden className={cx("size-4 transition", expanded && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
