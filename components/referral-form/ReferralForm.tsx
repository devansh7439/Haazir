"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Capability, CaseTemplate } from "@/lib/core/types";
import type { ParsedIntake } from "@/lib/modules/intake/intake.helper";
import { newRequestId } from "@/lib/ui/request-id";
import { CallPreview } from "./CallPreview";
import { CaseSection } from "./CaseSection";
import { NeedsSection } from "./NeedsSection";
import { PatientDetails } from "./PatientDetails";
import { PatientSection } from "./PatientSection";
import { SearchOptions } from "./SearchOptions";
import { SubmitBar } from "./SubmitBar";
import type { Acuity, AgeUnit, PatientFields, Sex } from "./types";
import { useReferralPreview } from "./useReferralPreview";

const DEFAULT_RADIUS_KM = 40;
const WIDE_RADIUS_KM = 80;

/** What the form still needs before it can be sent, as the hint under the button; null when nothing is missing. */
const missingStep = (caseType: string, acuity: string, needs: string[]): string | null =>
  !caseType ? "Choose a case" : !acuity ? "Set the acuity" : needs.length === 0 && caseType !== "other" ? "Add at least one need" : null;

/** The "Find a bed" form, with a live preview of what hospitals will hear. A WhatsApp draft pre-fills it. */
export function ReferralForm(props: {
  referrerId: string;
  templates: CaseTemplate[];
  capabilities: Capability[];
  defaultSimulate: boolean;
  bolnaReady: boolean;
  draft?: { id: string; parsed: ParsedIntake } | null;
}) {
  const d = props.draft?.parsed;
  const router = useRouter();
  const capByCode = useMemo(() => new Map(props.capabilities.map((c) => [c.code, c])), [props.capabilities]);
  const [caseType, setCaseType] = useState<string>(d?.case_type ?? "");
  const [needs, setNeeds] = useState<string[]>(d?.required_capabilities ?? []);
  const [acuity, setAcuity] = useState<Acuity | "">(d?.acuity ?? "");
  const [age, setAge] = useState<string>(d?.age_value != null ? String(d.age_value) : "");
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(d?.age_unit ?? "years");
  const [sex, setSex] = useState<Sex>(d?.sex ?? "unknown");
  const [note, setNote] = useState(d?.note ?? "");
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [showPatient, setShowPatient] = useState(false);
  const [patient, setPatient] = useState<PatientFields>({ patient_name: "", attendant_name: "", attendant_phone: "", attendant_language: "en", attendant_consent: false });
  const [simulate, setSimulate] = useState(props.defaultSimulate || !props.bolnaReady);
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
      transport: "ambulance" as const,
      search_radius_km: radius,
    }),
    [props.referrerId, caseType, needs, acuity, age, ageUnit, sex, note, radius],
  );
  const { preview, error: previewError, loading: loadingPreview } = useReferralPreview(body, caseType);

  const noteErrors = preview?.errors ?? [];
  const willCall = preview?.eligible.filter((e) => e.will_call) ?? [];
  const canSubmit = ready && noteErrors.length === 0 && willCall.length > 0 && !submitting && !(age !== "" && Number.isNaN(Number(age)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          simulate,
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

  return (
    <form onSubmit={submit} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      {/* overflow-clip (not hidden) keeps the rounded corners without breaking the sticky "Find a bed" bar. */}
      <section aria-label="Referral details" className="card overflow-clip">
        {props.draft && (
          <div className="flex items-start gap-3 border-b border-brand-100 bg-brand-50/60 px-5 py-3.5 text-sm sm:px-6">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <p className="text-brand-950">
              Filled from your WhatsApp {props.draft.parsed.matched.length ? `(${props.draft.parsed.matched.join(", ")})` : "message"}. Check every field before you start.
              {props.draft.parsed.note_dropped && " The note was left out because it may contain a name or number."}
            </p>
          </div>
        )}
        <CaseSection templates={props.templates} caseType={caseType} onPick={pickCase} />
        <NeedsSection capabilities={props.capabilities} needs={needs} onToggle={toggleNeed} />
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
        <PatientDetails open={showPatient} onToggle={() => setShowPatient((s) => !s)} patient={patient} onChange={setPatient} />
        <SearchOptions radius={radius} onRadius={setRadius} simulate={simulate} onSimulate={setSimulate} bolnaReady={props.bolnaReady} />
        <SubmitBar
          canSubmit={canSubmit}
          submitting={submitting}
          error={submitError}
          callCount={willCall.length}
          ready={ready}
          missing={missingStep(caseType, acuity, needs)}
        />
      </section>

      <CallPreview
        caseType={caseType}
        acuity={acuity}
        preview={preview}
        error={previewError}
        loading={loadingPreview}
        radius={radius}
        needs={needs}
        capByCode={capByCode}
        onWiden={() => setRadius(WIDE_RADIUS_KM)}
        onRemoveNeed={toggleNeed}
      />
    </form>
  );
}
