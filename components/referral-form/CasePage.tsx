import { ArrowRight } from "lucide-react";
import type { Capability, CaseTemplate } from "@/lib/core/types";
import { CaseSection } from "./CaseSection";
import { FormSection } from "./FormSection";
import { NeedsSection } from "./NeedsSection";
import { SearchOptions } from "./SearchOptions";

/** The first page of the full form: the case, what it needs and how far to search. */
export function CasePage(props: {
  templates: CaseTemplate[];
  capabilities: Capability[];
  caseType: string;
  onPickCase: (t: CaseTemplate) => void;
  needs: string[];
  onToggleNeed: (code: string) => void;
  radius: number;
  onRadius: (km: number) => void;
  bolnaReady: boolean;
  missing: string | null;
  onContinue: () => void;
}) {
  return (
    <>
      <FormSection step={1} title="Case" done={!!props.caseType}>
        <CaseSection templates={props.templates} caseType={props.caseType} onPick={props.onPickCase} />
      </FormSection>
      <FormSection
        step={2}
        title="Needs"
        hint={props.caseType ? "Filled from the case. Tap to change." : "Pick a case first; its usual needs are filled in."}
        done={props.needs.length > 0}
      >
        <NeedsSection capabilities={props.capabilities} needs={props.needs} onToggle={props.onToggleNeed} />
      </FormSection>
      <FormSection step={3} title="Search" last>
        <SearchOptions radius={props.radius} onRadius={props.onRadius} bolnaReady={props.bolnaReady} />
      </FormSection>
      <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
        {props.missing && <span className="text-sm text-zinc-500">{props.missing} to continue.</span>}
        <button type="button" onClick={props.onContinue} disabled={!!props.missing} className="btn btn-primary btn-lg rounded-xl px-5">
          Continue to patient <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
    </>
  );
}
