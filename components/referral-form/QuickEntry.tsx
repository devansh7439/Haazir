"use client";

import { ArrowRight, ChevronDown, FileText, Loader2, Lock, MapPin, Mic, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Capability, CaseTemplate } from "@/lib/core/types";
import { cx } from "@/components/ui";
import { CaseTiles } from "./CaseTiles";
import { PatientDetails } from "./PatientDetails";
import { ReachPanel } from "./ReachPanel";
import { ACUITY, FEATURED, RADII_KM } from "./options";
import type { Acuity, AgeUnit, PatientFields, Preview, Sex } from "./types";
import { useDictation } from "./useDictation";

const SEX_LETTER: Record<Sex, string> = { male: "M", female: "F", other: "O", unknown: "" };

/** A small pill for the options under the card. */
const PILL =
  "inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-[13px] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

/** A parsed fact as a chip; the × takes it back out. */
function FactChip(props: { children: React.ReactNode; onRemove?: () => void; label: string }) {
  return (
    <span className={cx("inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-100 pl-3 text-[13px] text-zinc-800", props.onRemove ? "pr-1.5" : "pr-3")}>
      {props.children}
      {props.onRemove && (
        <button type="button" aria-label={`Remove ${props.label}`} onClick={props.onRemove} className="grid size-5 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700">
          <X aria-hidden className="size-3" />
        </button>
      )}
    </span>
  );
}

/**
 * "Who needs a bed?": the referral as one sentence. Typing it fills the case, acuity, age, sex and needs as chips the doctor can
 * correct; the panel under it shows who would be called and how far away each is.
 */
export function QuickEntry(props: {
  text: string;
  onText: (text: string) => void;
  templates: CaseTemplate[];
  caseType: string;
  onPickCase: (t: CaseTemplate) => void;
  onClearCase: () => void;
  acuity: Acuity | "";
  onAcuity: (a: Acuity) => void;
  age: string;
  ageUnit: AgeUnit;
  sex: Sex;
  needs: string[];
  capByCode: Map<string, Capability>;
  onRemoveNeed: (code: string) => void;
  preview: Preview | null;
  loading: boolean;
  radius: number;
  onRadius: (km: number) => void;
  canSubmit: boolean;
  submitting: boolean;
  submitError: string | null;
  missing: string | null;
  showPatient: boolean;
  onTogglePatient: () => void;
  patient: PatientFields;
  onPatient: (p: PatientFields) => void;
  onFullForm: () => void;
}) {
  const { preview, caseType } = props;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const acuityRef = useRef<HTMLSelectElement>(null);
  const dictation = useDictation((spoken) => spoken && props.onText(props.text ? `${props.text} ${spoken}` : spoken));
  const willCallCount = preview?.eligible.filter((e) => e.will_call).length ?? 0;
  const template = props.templates.find((t) => t.case_type === caseType);
  const needLabels = props.needs.map((n) => props.capByCode.get(n)?.label ?? n);
  const featured = FEATURED.map((c) => props.templates.find((t) => t.case_type === c)).filter((t): t is CaseTemplate => !!t);
  const ageChip = props.age ? `${props.age} ${props.ageUnit === "years" ? "y" : props.ageUnit === "months" ? "mo" : "d"}${SEX_LETTER[props.sex] ? ` · ${SEX_LETTER[props.sex]}` : ""}` : null;
  // Acuity is never assumed (a wrong default is worse than a blocked button), so it is the usual reason "Find a bed" waits.
  const needsAcuity = !!caseType && !props.acuity;
  const hasChips = !!template || !!ageChip || props.needs.length > 0;

  // The box grows with what is typed.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 56)}px`;
  }, [props.text]);

  return (
    <div className="mx-auto max-w-[780px] pt-4 sm:pt-10">
      <header className="text-center">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[34px]">Who needs a bed?</h1>
        <p className="mx-auto mt-2.5 max-w-md text-balance text-[15px] leading-snug text-zinc-500">
          Describe the case in a line. Haazir phones every capable hospital at once and shows you who says yes.
        </p>
      </header>

      <div className="card-soft mt-7 transition focus-within:border-zinc-300 focus-within:ring-4 focus-within:ring-zinc-200/60">
        <div className="p-4 pb-3 sm:p-5 sm:pb-4">
          <label htmlFor="quick-text" className="sr-only">Describe the patient</label>
          <textarea
            id="quick-text"
            ref={taRef}
            autoFocus
            rows={1}
            value={props.text}
            onChange={(e) => props.onText(e.target.value)}
            placeholder="34M snakebite, ptosis 2 hrs, 10 vials ASV, critical"
            className="block w-full resize-none overflow-hidden bg-transparent text-lg leading-snug text-zinc-900 placeholder:text-zinc-300 focus:outline-none sm:text-xl"
          />
          {hasChips && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {template && <FactChip label="case" onRemove={props.onClearCase}>{template.label}</FactChip>}
              {caseType && (
                <span className="relative inline-flex">
                  <select
                    ref={acuityRef}
                    aria-label="Acuity"
                    value={props.acuity}
                    onChange={(e) => props.onAcuity(e.target.value as Acuity)}
                    className={cx(
                      "h-8 cursor-pointer appearance-none rounded-full pl-6 pr-7 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
                      props.acuity === "critical" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-800",
                      needsAcuity && "ring-2 ring-zinc-900",
                    )}
                  >
                    <option value="" disabled>{needsAcuity ? "Set acuity" : "Acuity"}</option>
                    {ACUITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                  <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full" style={{ background: ACUITY.find((a) => a.value === props.acuity)?.dot ?? "#a1a1aa" }} />
                  <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
                </span>
              )}
              {ageChip && <FactChip label="age and sex">{ageChip}</FactChip>}
              {props.needs.map((n, i) => (
                <FactChip key={n} label={needLabels[i] ?? n} onRemove={() => props.onRemoveNeed(n)}>{needLabels[i]}</FactChip>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-line bg-zinc-50/70 px-4 py-3 sm:px-5">
          <p className="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex">
            <kbd className="kbd">Ctrl</kbd>
            <kbd className="kbd">Enter</kbd>
            to send
          </p>
          <span className="ml-auto flex items-center gap-2">
            {dictation.supported && (
              <button
                type="button"
                onClick={dictation.toggle}
                aria-label={dictation.listening ? "Stop dictating" : "Dictate the referral"}
                aria-pressed={dictation.listening}
                className={cx("grid size-10 place-items-center rounded-full border transition", dictation.listening ? "border-rose-200 bg-rose-50 text-rose-600" : "border-line bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800")}
              >
                <Mic aria-hidden className="size-4" />
              </button>
            )}
            <button
              type="submit"
              aria-disabled={!props.canSubmit}
              onClick={(e) => {
                if (props.canSubmit) return;
                // Not dead: a click while acuity is missing opens the acuity choice instead of doing nothing.
                e.preventDefault();
                if (needsAcuity) {
                  acuityRef.current?.focus();
                  acuityRef.current?.showPicker?.();
                }
              }}
              className={cx("btn btn-primary h-10 rounded-full px-5", !props.canSubmit && "opacity-45")}
            >
              {props.submitting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {props.submitting ? "Starting calls…" : willCallCount > 0 && !props.missing ? `Call ${willCallCount} ${willCallCount === 1 ? "hospital" : "hospitals"}` : "Find a bed"}
              {!props.submitting && <ArrowRight aria-hidden className="size-4" />}
            </button>
          </span>
        </div>
      </div>
      {props.submitError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{props.submitError}</p>}

      <ReachPanel preview={preview} loading={props.loading} caseType={caseType} acuity={props.acuity} needLabels={needLabels} missing={props.missing} />

      <div className="mt-9">
        <CaseTiles cases={featured} caseType={caseType} onPick={props.onPickCase} />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={props.onTogglePatient} aria-expanded={props.showPatient} title="Shared only with the hospital you select" className={cx(PILL, props.showPatient && "border-zinc-300 text-zinc-900")}>
          <Lock aria-hidden className="size-3.5" /> Add patient name
        </button>
        <label className={cx(PILL, "relative cursor-pointer pr-8")}>
          <MapPin aria-hidden className="size-3.5" />
          Search within
          <select
            value={props.radius}
            onChange={(e) => props.onRadius(Number(e.target.value))}
            className="cursor-pointer appearance-none bg-transparent font-medium text-zinc-800 focus:outline-none"
          >
            {RADII_KM.map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
        </label>
        <button type="button" onClick={props.onFullForm} className={PILL}>
          <FileText aria-hidden className="size-3.5" /> Use the full form
        </button>
      </div>
      {props.showPatient && (
        <div className="mt-4">
          <PatientDetails open onToggle={props.onTogglePatient} patient={props.patient} onChange={props.onPatient} />
        </div>
      )}
    </div>
  );
}
