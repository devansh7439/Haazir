import { ChevronDown, Info } from "lucide-react";
import type { CaseTemplate } from "@/lib/core/types";
import { cx } from "@/components/ui";
import { FormSection } from "./FormSection";
import { FEATURED } from "./options";
import { useToggle } from "./useToggle";

/** The case chips: the featured cases (and the chosen one), or all of them. Picking one pre-fills the needs. */
export function CaseSection(props: { templates: CaseTemplate[]; caseType: string; onPick: (t: CaseTemplate) => void }) {
  const { templates, caseType, onPick } = props;
  const [showAll, toggleShowAll] = useToggle();
  const shown = showAll ? templates : templates.filter((t) => FEATURED.includes(t.case_type) || t.case_type === caseType);
  const template = templates.find((t) => t.case_type === caseType);
  return (
    <FormSection title="Case">
      <div className="flex flex-wrap gap-2">
        {shown.map((t) => (
          <button
            key={t.case_type}
            type="button"
            aria-pressed={caseType === t.case_type}
            onClick={() => onPick(t)}
            className={cx("chip", caseType === t.case_type ? "chip-on" : "chip-off")}
          >
            {t.label}
          </button>
        ))}
        <button type="button" onClick={toggleShowAll} className="chip border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50">
          {showAll ? "Show fewer" : `${templates.length - shown.length} more`}
          <ChevronDown aria-hidden className={cx("size-3.5 transition", showAll && "rotate-180")} />
        </button>
      </div>
      {/* The line keeps its height when empty, so picking a case doesn't push the sections below it down. */}
      <p className="flex min-h-8 items-start gap-1.5 sm:min-h-4 sm:items-center text-xs text-zinc-500">
        {template && !template.clinician_reviewed && (
          <>
            <Info aria-hidden className="size-3.5" /> Default needs are editable and not yet clinician-reviewed.
          </>
        )}
      </p>
    </FormSection>
  );
}
