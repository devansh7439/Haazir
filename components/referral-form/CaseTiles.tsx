import { Activity, Baby, Brain, Check, Droplet, HeartPulse, Siren, Worm, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";
import type { CaseTemplate } from "@/lib/core/types";

const CASE_ICON: Record<string, LucideIcon> = {
  snakebite_neuro: Worm,
  stroke: Brain,
  stemi: HeartPulse,
  head_injury: Siren,
  obstetric_bleed: Droplet,
  preterm_newborn: Baby,
};
/** The short names on the case tiles, so the six fit in one row. */
const TILE_LABEL: Record<string, string> = {
  snakebite_neuro: "Snakebite",
  stroke: "Stroke",
  stemi: "Heart attack",
  head_injury: "Head injury",
  obstetric_bleed: "Obstetric bleed",
  preterm_newborn: "Newborn",
};

/** One tap to start from a common emergency; the tapped tile stays dark and shows a tick. */
export function CaseTiles(props: { cases: CaseTemplate[]; caseType: string; onPick: (t: CaseTemplate) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 text-xs font-medium text-zinc-500">
        <span>Or start from a common case</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 lg:grid-cols-6">
        {props.cases.map((t) => {
          const Icon = CASE_ICON[t.case_type] ?? Activity;
          const on = props.caseType === t.case_type;
          return (
            <button
              key={t.case_type}
              type="button"
              aria-pressed={on}
              onClick={() => props.onPick(t)}
              className={cx(
                "group relative flex h-[92px] flex-col justify-between rounded-xl border p-2.5 text-left text-[13px] font-medium transition duration-150 sm:p-3",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                on
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.25)]"
                  : "border-line bg-white text-zinc-700 hover:-translate-y-px hover:border-zinc-300 hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.12)]",
              )}
            >
              <span className={cx("grid size-8 place-items-center rounded-lg transition", on ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-700 group-hover:bg-zinc-200/70")}>
                <Icon aria-hidden className="size-[17px]" strokeWidth={1.75} />
              </span>
              <span className="leading-tight">{TILE_LABEL[t.case_type] ?? t.label}</span>
              {on && <Check aria-hidden className="absolute right-2.5 top-2.5 size-3.5 text-white/80" strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
