"use client";

import { ArrowLeft, ArrowRight, Check, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cx } from "@/components/ui";
import type { Capability, CaseTemplate } from "@/lib/core/types";
import { parseIntake, type ParsedIntake } from "@/lib/modules/intake/intake.helper";
import { newRequestId } from "@/lib/ui/request-id";
import { CallPreview } from "./CallPreview";
import { CaseSection } from "./CaseSection";
import { FactsSection } from "./FactsSection";
import { FormSection } from "./FormSection";
import { HandoverSection } from "./HandoverSection";
import { NeedsSection } from "./NeedsSection";
import { PatientDetails } from "./PatientDetails";
import { PatientSection } from "./PatientSection";
import { QuickEntry } from "./QuickEntry";
import { SearchOptions } from "./SearchOptions";
import { TransferSection } from "./TransferSection";
import { NO_FACTS, factsBody, factsValid } from "./facts";
import { NO_HANDOVER, NO_TRANSFER, handoverBody, handoverValid, transferBody } from "./handover";
import { DEFAULT_RADIUS_KM, WIDE_RADIUS_KM } from "./options";
import { clinicalNote } from "./quick";
import type { Acuity, AgeUnit, FactFields, HandoverFields, PatientFields, Sex, TransferFields } from "./types";
import { useReferralPreview } from "./useReferralPreview";

/** What the form still needs before it can be sent, as the hint under the button; null when nothing is missing. */
const missingStep = (caseType: string, acuity: string, needs: string[]): string | null =>
  !caseType ? "Choose a case" : !acuity ? "Set the acuity" : needs.length === 0 && caseType !== "other" ? "Add at least one need" : null;

/** The page of the full form that is missing something, as the hint under "Continue"; null when the case page is complete. */
const missingCase = (caseType: string, needs: string[]): string | null =>
  !caseType ? "Choose a case" : needs.length === 0 && caseType !== "other" ? "Add at least one need" : null;

type Page = "case" | "patient";

/**
 * The referral, two ways in. "Who needs a bed?" takes one typed sentence and fills in what it recognises; "Find a bed" is the
 * full form on two pages (the case and what it needs, then the patient), with a live preview of what hospitals will hear on
 * both. Both edit the same fields. A WhatsApp draft opens the full form, pre-filled.
 */
export function ReferralForm(props: {
  referrerId: string;
  templates: CaseTemplate[];
  capabilities: Capability[];
  bolnaReady: boolean;
  draft?: { id: string; parsed: ParsedIntake } | null;
}) {
  const d = props.draft?.parsed;
  const router = useRouter();
  const capByCode = useMemo(() => new Map(props.capabilities.map((c) => [c.code, c])), [props.capabilities]);
  const [mode, setMode] = useState<"quick" | "form">(props.draft ? "form" : "quick");
  const [page, setPage] = useState<Page>("case");
  const [text, setText] = useState("");
  const [caseType, setCaseType] = useState<string>(d?.case_type ?? "");
  const [needs, setNeeds] = useState<string[]>(d?.required_capabilities ?? []);
  const [acuity, setAcuity] = useState<Acuity | "">(d?.acuity ?? "");
  const [age, setAge] = useState<string>(d?.age_value != null ? String(d.age_value) : "");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(d?.age_unit ?? "years");
  const [sex, setSex] = useState<Sex>(d?.sex ?? "unknown");
  const [note, setNote] = useState(d?.note ?? "");
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [facts, setFacts] = useState<FactFields>(NO_FACTS);
  const [handover, setHandover] = useState<HandoverFields>(NO_HANDOVER);
  const [transfer, setTransfer] = useState<TransferFields>(NO_TRANSFER);
  const [showPatient, setShowPatient] = useState(false);
  const [patient, setPatient] = useState<PatientFields>({ patient_name: "", attendant_name: "", attendant_phone: "", attendant_language: "en", attendant_consent: false });
  // One id per press of "Find a bed": a double-click or a retry after a network error reuses it, so hospitals are
  // never called twice for the same patient.
  const [requestId] = useState(newRequestId);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const ready = !!caseType && !!acuity && (needs.length > 0 || caseType === "other");
  const toggleNeed = (code: string) => setNeeds((n) => (n.includes(code) ? n.filter((c) => c !== code) : [...n, code]));
  const pickCase = (t: CaseTemplate) => {
    setCaseType(t.case_type);
    setNeeds(t.default_capabilities);
  };

  /** Typing a sentence fills what it names and leaves the rest as the doctor set it. */
  const onQuickText = (value: string) => {
    setText(value);
    const p = parseIntake(value, props.templates);
    if (p.case_type && p.case_type !== caseType) {
      setCaseType(p.case_type);
      setNeeds(p.required_capabilities);
    }
    if (p.acuity) setAcuity(p.acuity);
    if (p.age_value !== null) {
      setAge(String(p.age_value));
      setAgeUnit(p.age_unit);
    }
    if (p.sex !== "unknown") setSex(p.sex);
    setNote(clinicalNote(value));
  };

  const body = useMemo(
    () => ({
      referrer_id: props.referrerId,
      case_type: caseType,
      required_capabilities: needs,
      acuity: acuity || "critical",
      age_value: age === "" ? null : Number(age),
      age_unit: ageUnit,
      sex,
      note: note.trim() || null,
      ...factsBody(facts),
      ...handoverBody(handover),
      ...transferBody(transfer),
      transport: "ambulance" as const,
      search_radius_km: radius,
    }),
    [props.referrerId, caseType, needs, acuity, age, ageUnit, sex, note, facts, handover, transfer, radius],
  );
  const { preview, error: previewError, loading: loadingPreview } = useReferralPreview(body, caseType);

  const noteErrors = preview?.errors ?? [];
  const willCall = preview?.eligible.filter((e) => e.will_call) ?? [];
  const canSubmit = ready && noteErrors.length === 0 && willCall.length > 0 && !submitting && factsValid(facts) && handoverValid(handover) && !(age !== "" && Number.isNaN(Number(age)));
  const missing = missingStep(caseType, acuity, needs);
  const caseMissing = missingCase(caseType, needs);

  const goTo = (next: Page) => {
    if (next === "patient" && caseMissing) return;
    setPage(next);
    window.scrollTo({ top: 0 });
  };

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    // Enter or ⌘/Ctrl + Enter on the case page moves on to the patient page instead of starting calls.
    if (mode === "form" && page === "case") return goTo("patient");
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          draft_id: props.draft?.id,
          client_request_id: requestId,
          patient: showPatient || patient.patient_name || patient.attendant_phone ? patient : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error?.message ?? "Could not start the referral");
        setSubmitting(false);
        return;
      }
      router.push(`/referrals/${data.id}`);
    } catch {
      setSubmitError("Network error: check the connection and try again");
      setSubmitting(false);
    }
  }

  // ⌘/Ctrl + Enter sends the referral from anywhere in the form, including from inside a text box.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
  };

  if (mode === "quick") {
    return (
      <form onSubmit={submit} onKeyDown={onKeyDown}>
        <QuickEntry
          text={text}
          onText={onQuickText}
          templates={props.templates}
          caseType={caseType}
          onPickCase={pickCase}
          onClearCase={() => {
            setCaseType("");
            setNeeds([]);
          }}
          acuity={acuity}
          onAcuity={setAcuity}
          age={age}
          ageUnit={ageUnit}
          sex={sex}
          needs={needs}
          capByCode={capByCode}
          onRemoveNeed={toggleNeed}
          preview={preview}
          loading={loadingPreview}
          radius={radius}
          onRadius={setRadius}
          canSubmit={canSubmit}
          submitting={submitting}
          submitError={submitError ?? noteErrors[0] ?? null}
          missing={missing}
          showPatient={showPatient}
          onTogglePatient={() => setShowPatient((s) => !s)}
          patient={patient}
          onPatient={setPatient}
          onFullForm={() => setMode("form")}
        />
      </form>
    );
  }

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-zinc-900">Find a bed</h1>
          <p className="mt-2 max-w-xl text-[15px] leading-snug text-zinc-500">
            Haazir calls every capable hospital nearby at once, in their language, and shows you who says yes.
          </p>
        </div>
        <button type="button" onClick={() => setMode("quick")} className="btn btn-secondary">
          <Zap aria-hidden className="size-4" /> Quick entry
        </button>
      </div>
      {props.draft && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-line bg-zinc-50 px-4 py-3 text-sm">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-zinc-600" />
          <p className="text-zinc-800">
            Filled from your WhatsApp {props.draft.parsed.matched.length ? `(${props.draft.parsed.matched.join(", ")})` : "message"}. Check every field before you start.
            {props.draft.parsed.note_dropped && " The note was left out because it may contain a name or number."}
          </p>
        </div>
      )}
      <nav aria-label="Referral pages" className="mb-8 flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => goTo("case")}
          aria-current={page === "case" ? "step" : undefined}
          className={cx("inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition", page === "case" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}
        >
          <span aria-hidden className={cx("grid size-5 place-items-center rounded-full text-[11px]", page === "case" ? "bg-white/20" : "bg-zinc-900 text-white")}>
            {page === "patient" && !caseMissing ? <Check className="size-3" strokeWidth={3} /> : 1}
          </span>
          Case
        </button>
        <span aria-hidden className="h-px w-6 bg-zinc-300" />
        <button
          type="button"
          onClick={() => goTo("patient")}
          disabled={!!caseMissing}
          aria-current={page === "patient" ? "step" : undefined}
          className={cx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition disabled:cursor-not-allowed disabled:text-zinc-400",
            page === "patient" ? "bg-zinc-900 text-white" : "text-zinc-600 enabled:hover:bg-zinc-100",
          )}
        >
          <span aria-hidden className={cx("grid size-5 place-items-center rounded-full text-[11px]", page === "patient" ? "bg-white/20" : "border border-zinc-300")}>2</span>
          Patient
        </button>
      </nav>
      <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          {page === "case" ? (
            <>
              <FormSection step={1} title="Case" done={!!caseType}>
                <CaseSection templates={props.templates} caseType={caseType} onPick={pickCase} />
              </FormSection>
              <FormSection step={2} title="Needs" hint={caseType ? "Filled from the case. Tap to change." : "Pick a case first; its usual needs are filled in."} done={needs.length > 0}>
                <NeedsSection capabilities={props.capabilities} needs={needs} onToggle={toggleNeed} />
              </FormSection>
              <FormSection step={3} title="Search" last>
                <SearchOptions radius={radius} onRadius={setRadius} bolnaReady={props.bolnaReady} />
              </FormSection>
              <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
                {caseMissing && <span className="text-sm text-zinc-500">{caseMissing} to continue.</span>}
                <button type="button" onClick={() => goTo("patient")} disabled={!!caseMissing} className="btn btn-primary btn-lg rounded-xl px-5">
                  Continue to patient <ArrowRight aria-hidden className="size-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <FormSection step={1} title="Patient" done={!!acuity}>
                <PatientSection
                  acuity={acuity}
                  onAcuity={setAcuity}
                  age={age}
                  onAge={setAge}
                  ageUnit={ageUnit}
                  onAgeUnit={setAgeUnit}
                  sex={sex}
                  onSex={setSex}
                  note={note}
                  onNote={setNote}
                  noteErrors={noteErrors}
                  warnings={preview?.warnings ?? []}
                />
              </FormSection>
              <FormSection step={2} title="Bedside status and cover" hint="Optional. Airway, SpO₂ and GCS are read to every hospital; payment and medico-legal are told only if a desk asks.">
                <FactsSection facts={facts} onChange={setFacts} />
              </FormSection>
              <FormSection step={3} title="Handover" hint="Optional. Pregnancy, how it happened, infection risk and blood need are read to every hospital; treatment given and blood group are told only if a desk asks.">
                <HandoverSection handover={handover} sex={sex} onChange={setHandover} />
              </FormSection>
              <FormSection step={4} title="Transfer consent" hint="Optional. Kept on the referral and printed on the referral slip.">
                <TransferSection transfer={transfer} onChange={setTransfer} />
              </FormSection>
              <FormSection step={5} title="Private details" hint="Optional." last>
                <PatientDetails open={showPatient} onToggle={() => setShowPatient((s) => !s)} patient={patient} onChange={setPatient} />
              </FormSection>
              <div className="mt-8">
                <button type="button" onClick={() => goTo("case")} className="btn btn-secondary">
                  <ArrowLeft aria-hidden className="size-4" /> Back to case
                </button>
              </div>
            </>
          )}
        </div>

        <CallPreview
          caseType={caseType}
          acuity={acuity}
          preview={preview}
          error={previewError}
          loading={loadingPreview}
          radius={radius}
          needs={needs}
          capByCode={capByCode}
          canSubmit={canSubmit}
          showSubmit={page === "patient"}
          submitting={submitting}
          submitError={submitError}
          missing={missing}
          onWiden={() => setRadius(WIDE_RADIUS_KM)}
          onRemoveNeed={toggleNeed}
        />
      </div>
    </form>
  );
}
