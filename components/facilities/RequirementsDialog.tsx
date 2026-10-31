import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Capability } from "@/lib/core/types";
import { groupByCategory } from "@/lib/ui/facility";
import { cx } from "../ui";

/** A popup to pick what a hospital must offer. The button shows how many hospitals match, live. */
export function RequirementsDialog(props: {
  capabilities: Capability[];
  selected: string[];
  matches: number;
  onToggle: (code: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={props.onClose}
      aria-labelledby="req-h"
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-line p-0 shadow-2xl backdrop:bg-zinc-950/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-3 px-6 pt-5">
        <div>
          <h2 id="req-h" className="text-lg font-semibold tracking-tight">Requirements</h2>
          <p className="mt-0.5 text-sm text-zinc-500">Show only hospitals that offer all of these.</p>
        </div>
        <button aria-label="Close" className="btn btn-ghost px-2.5" onClick={() => ref.current?.close()}><X aria-hidden className="size-5" /></button>
      </div>

      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
        {groupByCategory(props.capabilities).map((g) => (
          <div key={g.category}>
            <div className="eyebrow mb-1.5">{g.title}</div>
            <div className="flex flex-wrap gap-2">
              {g.items.map((c) => {
                const on = props.selected.includes(c.code);
                return (
                  <button key={c.code} type="button" aria-pressed={on} className={cx("chip", on ? "chip-on" : "chip-off")} onClick={() => props.onToggle(c.code)}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        <button type="button" className="btn btn-ghost" disabled={props.selected.length === 0} onClick={props.onClear}>Clear all</button>
        <button type="button" className="btn btn-primary" onClick={() => ref.current?.close()}>
          {props.matches === 0 ? "No hospital matches" : `Show ${props.matches} ${props.matches === 1 ? "hospital" : "hospitals"}`}
        </button>
      </div>
    </dialog>
  );
}
