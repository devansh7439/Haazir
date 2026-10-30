"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Capability, CaseTemplate } from "@/lib/types";
import { LANGUAGE_LABEL, shortName } from "@/lib/ui";

interface Eligible {
  facility_id: string;
  name: string;
  distance_km: number;
  eta_minutes: number;
  call_language: string;
  rank_reasons: string[];
  will_call: boolean;
}

interface Preview {
  spoken_summary: string | null;
  warnings: string[];
  errors?: string[];
  eligible: Eligible[];
  suggestions: string[];
  wave_size?: number;
}

const FEATURED = ["snakebite_neuro", "head_injury", "stemi", "stroke", "preterm_newborn", "obstetric_bleed"];

export function ReferralForm(props: {
  referrerId: string;
  templates: CaseTemplate[];
  capabilities: Capability[];
  defaultSimulate: boolean;
  bolnaReady: boolean;
}) {
  const router = useRouter();
  const capByCode = useMemo(() => new Map(props.capabilities.map((c) => [c.code, c])), [props.capabilities]);
  const [caseType, setCaseType] = useState<string>("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [showAllCases, setShowAllCases] = useState(false);
  const [showAllNeeds, setShowAllNeeds] = useState(false);
  const [acuity, setAcuity] = useState<"critical" | "serious" | "stable" | "">("");
  const [age, setAge] = useState<string>("");
  const [ageUnit, setAgeUnit] = useState<"years" | "months" | "days">("years");
  const [sex, setSex] = useState<"male" | "female" | "other" | "unknown">("unknown");
  const [note, setNote] = useState("");
  const [radius, setRadius] = useState(40);
  const [showPatient, setShowPatient] = useState(false);
  const [patient, setPatient] = useState({ patient_name: "", attendant_name: "", attendant_phone: "", attendant_language: "en" });
  const [simulate, setSimulate] = useState(props.defaultSimulate);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const template = props.templates.find((t) => t.case_type === caseType);
  const ready = !!caseType && !!acuity && (needs.length > 0 || caseType === "other");

  function pickCase(t: CaseTemplate) {
    setCaseType(t.case_type);
    setNeeds(t.default_capabilities);
  }

  function toggleNeed(code: string) {
    setNeeds((n) => (n.includes(code) ? n.filter((c) => c !== code) : [...n, code]));
  }

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

  // "What hospitals will hear": debounced preview, no side effects.
  useEffect(() => {
    if (!caseType) {
      setPreview(null);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/referrals/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setPreviewError(data?.error?.message ?? "Preview failed");
          return;
        }
        setPreviewError(null);
        setPreview(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setPreviewError("Preview failed");
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [body, caseType]);

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

  const casesShown = showAllCases ? props.templates : props.templates.filter((t) => FEATURED.includes(t.case_type) || t.case_type === caseType);
  const needsShown = showAllNeeds ? props.capabilities : props.capabilities.filter((c) => needs.includes(c.code));

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="new-h" className="card space-y-5 p-4 sm:p-5">
        <h1 id="new-h" className="text-lg font-bold uppercase tracking-wide text-slate-500">New referral</h1>

        <fieldset>
          <legend className="label">Case</legend>
          <div className="flex flex-wrap gap-2">
            {casesShown.map((t) => (
              <button
                key={t.case_type}
                type="button"
                aria-pressed={caseType === t.case_type}
                onClick={() => pickCase(t)}
                className={`chip ${caseType === t.case_type ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}
              >
                {t.label}
              </button>
            ))}
            <button type="button" onClick={() => setShowAllCases((s) => !s)} className="chip border-dashed border-slate-400 text-slate-700">
              {showAllCases ? "Fewer" : "More…"}
            </button>
          </div>
          {template && !template.clinician_reviewed && (
            <p className="mt-1 text-xs text-slate-500">Default needs for this case are editable and not yet clinician-reviewed.</p>
          )}
        </fieldset>

        <fieldset>
          <legend className="label">Needs</legend>
          <div className="flex flex-wrap gap-2">
            {needsShown.map((c) => (
              <button
                key={c.code}
                type="button"
                aria-pressed={needs.includes(c.code)}
                onClick={() => toggleNeed(c.code)}
                className={`chip ${needs.includes(c.code) ? "border-green-700 bg-green-50 text-green-900" : "border-slate-300 bg-white text-slate-700"}`}
              >
                {needs.includes(c.code) ? "✓ " : "+ "}
                {c.label}
              </button>
            ))}
            <button type="button" onClick={() => setShowAllNeeds((s) => !s)} className="chip border-dashed border-slate-400 text-slate-700">
              {showAllNeeds ? "Done" : "+ add need"}
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend className="label">Acuity</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {(["critical", "serious", "stable"] as const).map((a) => (
              <label key={a} className={`chip cursor-pointer ${acuity === a ? "border-red-700 bg-red-700 text-white" : "border-slate-300 bg-white"}`}>
                <input type="radio" name="acuity" value={a} checked={acuity === a} onChange={() => setAcuity(a)} className="sr-only" />
                {acuity === a ? "● " : "○ "}
                {a[0].toUpperCase() + a.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="age" className="label">Age</label>
            <input id="age" inputMode="numeric" className="input" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          </div>
          <div>
            <label htmlFor="age-unit" className="label">Unit</label>
            <select id="age-unit" className="input" value={ageUnit} onChange={(e) => setAgeUnit(e.target.value as typeof ageUnit)}>
              <option value="years">years</option>
              <option value="months">months</option>
              <option value="days">days</option>
            </select>
          </div>
          <div>
            <label htmlFor="sex" className="label">Sex</label>
            <select id="sex" className="input" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="note" className="label">Note <span className="font-normal text-slate-500">(spoken to every hospital)</span></label>
          <textarea
            id="note"
            className="input min-h-20 py-2"
            maxLength={160}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby="note-help"
            aria-invalid={noteErrors.length > 0}
            placeholder="e.g. Drooping eyelids 2 hrs after bite. Given 10 vials ASV."
          />
          <div id="note-help" className="mt-1 flex justify-between gap-2 text-xs">
            <span className="text-slate-600">ⓘ No names, phone numbers or IDs</span>
            <span className="text-slate-500">{note.length}/160</span>
          </div>
          {noteErrors.map((m) => (
            <p key={m} role="alert" className="mt-1 text-sm font-semibold text-red-700">✖ {m}</p>
          ))}
          {preview?.warnings.map((m) => (
            <p key={m} className="mt-1 text-sm text-amber-800">⚠ {m}</p>
          ))}
        </div>

        <details open={showPatient} onToggle={(e) => setShowPatient((e.target as HTMLDetailsElement).open)} className="rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer font-semibold">Patient &amp; family <span className="font-normal text-slate-600">(shared only after a hospital accepts)</span></summary>
          <p className="mt-2 text-sm text-slate-600">Shared only with the hospital that accepts, on WhatsApp. Never spoken on the first calls.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([
              ["patient_name", "Patient name"],
              ["attendant_name", "Attendant name"],
              ["attendant_phone", "Attendant phone"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <label htmlFor={k} className="label">{label}</label>
                <input id={k} className="input" value={patient[k]} onChange={(e) => setPatient((p) => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label htmlFor="att-lang" className="label">Attendant language</label>
              <select id="att-lang" className="input" value={patient.attendant_language} onChange={(e) => setPatient((p) => ({ ...p, attendant_language: e.target.value }))}>
                <option value="en">English</option>
                <option value="kn">Kannada</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </div>
        </details>

        <div className="grid grid-cols-2 items-end gap-3">
          <div>
            <label htmlFor="radius" className="label">Radius</label>
            <select id="radius" className="input" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {[20, 40, 60, 80, 120].map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} className="size-5" />
            Run as simulation
          </label>
        </div>
        {!props.bolnaReady && (
          <p className="text-xs text-slate-500">Bolna isn&apos;t configured on this deployment, so referrals run as simulations.</p>
        )}

        {submitError && <p role="alert" className="rounded-lg bg-red-50 p-3 font-semibold text-red-800">{submitError}</p>}
        <button type="submit" disabled={!canSubmit} className="btn btn-primary w-full text-lg">
          {submitting ? "Starting calls…" : "Find a bed"}
        </button>
      </section>

      <section aria-labelledby="hear-h" aria-live="polite" className="card space-y-4 p-4 sm:p-5">
        <h2 id="hear-h" className="text-lg font-bold uppercase tracking-wide text-slate-500">What hospitals will hear</h2>
        {!caseType && <p className="text-slate-600">Pick a case to see the exact words each hospital hears and who will be called.</p>}
        {previewError && <p className="text-red-700">{previewError}</p>}
        {preview?.spoken_summary && acuity && (
          <blockquote className="rounded-lg border-l-4 border-blue-700 bg-blue-50 p-4 text-lg leading-relaxed">
            “{preview.spoken_summary}”
          </blockquote>
        )}
        {caseType && !acuity && <p className="text-sm text-slate-600">Set the acuity to continue.</p>}
        {preview && preview.eligible.length > 0 && (
          <div>
            <h3 className="mb-2 font-bold">{willCall.length} hospital{willCall.length === 1 ? "" : "s"} will be called</h3>
            <ol className="space-y-2">
              {preview.eligible.map((e, i) => (
                <li key={e.facility_id} className={`rounded-lg border p-3 ${e.will_call ? "border-slate-200" : "border-dashed border-slate-200 opacity-70"}`}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold">{i + 1}</span>
                    <span className="font-semibold">{shortName(e.name)}</span>
                    <span className="text-slate-600">· {e.eta_minutes} min · {LANGUAGE_LABEL[e.call_language] ?? e.call_language}</span>
                    {!e.will_call && <span className="text-xs text-slate-500">(next round if needed)</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {e.rank_reasons.map((r) => (
                      <span key={r} className={`rounded px-2 py-0.5 text-xs ${r === "IVR line only" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{r}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {preview && preview.spoken_summary && preview.eligible.length === 0 && (
          <div className="rounded-lg bg-amber-50 p-4">
            <p className="font-semibold">
              No hospital within {radius} km has {needs.map((n) => capByCode.get(n)?.label ?? n).join(" + ") || "these needs"}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {radius < 80 && (
                <button type="button" className="btn btn-secondary" onClick={() => setRadius(80)}>Widen to 80 km</button>
              )}
              {preview.suggestions
                .filter((s) => s.startsWith("remove: "))
                .map((s) => {
                  const code = s.slice("remove: ".length);
                  return (
                    <button key={s} type="button" className="btn btn-secondary" onClick={() => toggleNeed(code)}>
                      Remove {capByCode.get(code)?.label ?? code}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </section>
    </form>
  );
}
