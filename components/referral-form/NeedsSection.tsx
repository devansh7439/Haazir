import { Plus } from "lucide-react";
import type { Capability } from "@/lib/core/types";
import { cx } from "@/components/ui";
import { useToggle } from "./useToggle";

/** The chosen needs as chips; "Add need" shows every capability to choose from. */
export function NeedsSection(props: { capabilities: Capability[]; needs: string[]; onToggle: (code: string) => void }) {
  const { capabilities, needs, onToggle } = props;
  const [showAll, toggleShowAll] = useToggle();
  const shown = showAll ? capabilities : capabilities.filter((c) => needs.includes(c.code));
  return (
    <div className="flex min-h-9 flex-wrap gap-2">
      {shown.map((c) => (
        <button
          key={c.code}
          type="button"
          aria-pressed={needs.includes(c.code)}
          onClick={() => onToggle(c.code)}
          className={cx("chip", needs.includes(c.code) ? "chip-on" : "chip-off")}
        >
          {c.label}
        </button>
      ))}
      <button type="button" onClick={toggleShowAll} className="chip border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50">
        {showAll ? "Done" : <><Plus aria-hidden className="size-3.5" /> Add need</>}
      </button>
    </div>
  );
}
