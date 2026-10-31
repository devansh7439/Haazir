import type { Capability } from "@/lib/core/types";
import { cx } from "@/components/ui";
import { FormSection } from "./FormSection";
import { useToggle } from "./useToggle";

/** The chosen needs as chips; "Add need" shows every capability to choose from. */
export function NeedsSection(props: { capabilities: Capability[]; needs: string[]; onToggle: (code: string) => void }) {
  const { capabilities, needs, onToggle } = props;
  const [showAll, toggleShowAll] = useToggle();
  const shown = showAll ? capabilities : capabilities.filter((c) => needs.includes(c.code));
  return (
    <FormSection title="Needs">
      <div className="flex min-h-9 flex-wrap gap-2">
        {shown.map((c) => (
          <button
            key={c.code}
            type="button"
            aria-pressed={needs.includes(c.code)}
            onClick={() => onToggle(c.code)}
            className={cx("chip", needs.includes(c.code) ? "chip-on" : "chip-off")}
          >
            <span aria-hidden className={cx("size-1.5 rounded-full", needs.includes(c.code) ? "bg-white" : "bg-zinc-300")} />
            {c.label}
          </button>
        ))}
        <button type="button" onClick={toggleShowAll} className="chip border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50">
          {showAll ? "Done" : "Add need"}
        </button>
      </div>
    </FormSection>
  );
}
