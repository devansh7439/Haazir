import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { PREFLIGHT_CHECKLIST } from "@/lib/ui/demo";
import { cx } from "../ui";
import { Panel } from "./Panel";

export function ChecklistPanel() {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  return (
    <Panel title="Pre-flight checklist" description={`${checked.size} of ${PREFLIGHT_CHECKLIST.length} done`}>
      <ul className="divide-y divide-line">
        {PREFLIGHT_CHECKLIST.map((item, i) => {
          const on = checked.has(i);
          return (
            <li key={item}>
              <button
                type="button"
                aria-pressed={on}
                className="flex w-full items-start gap-3 px-5 py-3 text-left text-sm hover:bg-zinc-50"
                onClick={() => setChecked((s) => { const n = new Set(s); if (on) n.delete(i); else n.add(i); return n; })}
              >
                {on ? <CheckCircle2 aria-hidden className="mt-px size-4 shrink-0 text-brand-600" /> : <Circle aria-hidden className="mt-px size-4 shrink-0 text-zinc-300" />}
                <span className={cx(on ? "text-zinc-400 line-through" : "text-zinc-800")}>{item}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
