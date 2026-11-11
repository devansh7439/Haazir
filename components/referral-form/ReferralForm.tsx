"use client";

import { useMemo, useState } from "react";
import type { Capability, CaseTemplate } from "@/lib/core/types";
import { parseIntake, type ParsedIntake } from "@/lib/modules/intake/intake.helper";
import { newRequestId } from "@/lib/ui/request-id";
import { CallPreview } from "./CallPreview";
import { CasePage } from "./CasePage";
import { DraftBanner } from "./DraftBanner";
import { FormHeader } from "./FormHeader";
import { PageTabs } from "./PageTabs";
import { PatientPage } from "./PatientPage";
import { QuickEntry } from "./QuickEntry";
import { NO_FACTS, factsBody, factsValid } from "./facts";
import { NO_HANDOVER, NO_TRANSFER, handoverBody, handoverValid, transferBody } from "./handover";
import { DEFAULT_RADIUS_KM, WIDE_RADIUS_KM } from "./options";
import { clinicalNote } from "./quick";
import { missingCase, missingStep, type Page } from "./steps";
import type { Acuity, AgeUnit, FactFields, HandoverFields, PatientFields, Sex, TransferFields } from "./types";
import { useReferralPreview } from "./useReferralPreview";
import { useReferralSubmit } from "./useReferralSubmit";

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
  const { submitting, submitError, send } = useReferralSubmit();

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
  const ageInvalid = age !== "" && Number.isNaN(Number(age));
  const detailsValid = factsValid(facts) && handoverValid(handover) && !ageInvalid;
  const canSubmit = ready && noteErrors.length === 0 && willCall.length > 0 && !submitting && detailsValid;
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
    await send({
      ...body,
      draft_id: props.draft?.id,
      client_request_id: requestId,
      patient: showPatient || patient.patient_name || patient.attendant_phone ? patient : undefined,
    });
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
      <FormHeader onQuickEntry={() => setMode("quick")} />
      {props.draft && <DraftBanner parsed={props.draft.parsed} />}
      <PageTabs page={page} caseMissing={caseMissing} onGo={goTo} />
      <div className="grid grid-cols-1 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          {page === "case" ? (
            <CasePage
              templates={props.templates}
              capabilities={props.capabilities}
              caseType={caseType}
              onPickCase={pickCase}
              needs={needs}
              onToggleNeed={toggleNeed}
              radius={radius}
              onRadius={setRadius}
              bolnaReady={props.bolnaReady}
              missing={caseMissing}
              onContinue={() => goTo("patient")}
            />
          ) : (
            <PatientPage
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
              facts={facts}
              onFacts={setFacts}
              handover={handover}
              onHandover={setHandover}
              transfer={transfer}
              onTransfer={setTransfer}
              showPatient={showPatient}
              onTogglePatient={() => setShowPatient((v) => !v)}
              patient={patient}
              onPatient={setPatient}
              onBack={() => goTo("case")}
            />
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
