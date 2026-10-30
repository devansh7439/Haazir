"use client";

import { AudioLines, ChevronDown, Info, Loader2, Lock, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ParsedIntake } from "@/lib/intakeParse";
import type { Capability, CaseTemplate } from "@/lib/types";
import { LANGUAGE_LABEL, shortName } from "@/lib/ui";
import { cx } from "./ui";

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
  skipped_far?: number;
  max_eta_minutes?: number | null;
}

const FEATURED = ["snakebite_neuro", "head_injury", "stemi", "stroke", "preterm_newborn", "obstetric_bleed"];

const ACUITY = [
  { value: "critical", label: "Critical", dot: "bg-rose-500" },
  { value: "serious", label: "Serious", dot: "bg-amber-500" },
  { value: "stable", label: "Stable", dot: "bg-emerald-500" },
] as const;

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-line px-5 py-5 first:border-t-0 sm:px-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

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
  const [showAllCases, setShowAllCases] = useState(false);
  const [showAllNeeds, setShowAllNeeds] = useState(false);
  const [acuity, setAcuity] = useState<"critical" | "serious" | "stable" | "">(d?.acuity ?? "");
  const [age, setAge] = useState<string>(d?.age_value != null ? String(d.age_value) : "");
  const [ageUnit, setAgeUnit] = useState<"years" | "months" | "days">(d?.age_unit ?? "years");
  const [sex, setSex] = useState<"male" | "female" | "other" | "unknown">(d?.sex ?? "unknown");
  const [note, setNote] = useState(d?.note ?? "");
  const [radius, setRadius] = useState(40);
  const [showPatient, setShowPatient] = useState(false);
  const [patient, setPatient] = useState({ patient_name: "", attendant_name: "", attendant_phone: "", attendant_language: "en" });
  const [simulate, setSimulate] = useState(props.defaultSimulate || !props.bolnaReady);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
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
    setLoadingPreview(true);
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
        } else {
          setPreviewError(null);
          setPreview(data);
        }
        setLoadingPreview(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setPreviewError("Preview failed");
          setLoadingPreview(false);
        }
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
          draft_id: props.draft?.id,
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
  const missing = !caseType ? "Choose a case" : !acuity ? "Set the acuity" : needs.length === 0 && caseType !== "other" ? "Add at least one need" : null;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <section aria-label="Referral details" className="card overflow-hidden">
        {props.draft && (
          <div className="flex items-start gap-3 border-b border-brand-100 bg-brand-50/60 px-5 py-3.5 text-sm sm:px-6">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <p className="text-brand-950">
              Filled from your WhatsApp {props.draft.parsed.matched.length ? `(${props.draft.parsed.matched.join(", ")})` : "message"}. Check every field before you start.
              {props.draft.parsed.note_dropped && " The note was left out because it may contain a name or number."}
            </p>
          </div>
        )}
        <Section title="Case" description="Picking a case pre-fills what the patient needs. You can change it.">
          <div className="flex flex-wrap gap-2">
            {casesShown.map((t) => (
              <button
                key={t.case_type}
                type="button"
                aria-pressed={caseType === t.case_type}
                onClick={() => pickCase(t)}
                className={cx("chip", caseType === t.case_type ? "chip-on" : "chip-off")}
              >
                {t.label}
              </button>
            ))}
            <button type="button" onClick={() => setShowAllCases((s) => !s)} className="chip border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50">
              {showAllCases ? "Show fewer" : `${props.templates.length - casesShown.length} more`}
              <ChevronDown aria-hidden className={cx("size-3.5 transition", showAllCases && "rotate-180")} />
            </button>
          </div>
          {template && !template.clinician_reviewed && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Info aria-hidden className="size-3.5" /> Default needs are editable and not yet clinician-reviewed.
            </p>
          )}
        </Section>

        <Section title="Needs" description="What the receiving hospital must have. Only hospitals with all of these are called.">
          <div className="flex flex-wrap gap-2">
            {needsShown.map((c) => (
              <button
                key={c.code}
                type="button"
                aria-pressed={needs.includes(c.code)}
                onClick={() => toggleNeed(c.code)}
                className={cx("chip", needs.includes(c.code) ? "chip-on" : "chip-off")}
              >
                <span aria-hidden className={cx("size-1.5 rounded-full", needs.includes(c.code) ? "bg-brand-500" : "bg-zinc-300")} />
                {c.label}
              </button>
            ))}
            <button type="button" onClick={() => setShowAllNeeds((s) => !s)} className="chip border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50">
              {showAllNeeds ? "Done" : "Add need"}
            </button>
          </div>
        </Section>

        <Section title="Patient">
          <div role="radiogroup" aria-label="Acuity" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
            {ACUITY.map((a) => (
              <label
                key={a.value}
                className={cx(
                  "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition",
                  acuity === a.value ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgba(16,24,40,0.12)]" : "text-zinc-600 hover:text-zinc-900",
                )}
              >
                <input type="radio" name="acuity" value={a.value} checked={acuity === a.value} onChange={() => setAcuity(a.value)} className="sr-only" />
                <span aria-hidden className={cx("size-2 rounded-full", a.dot)} />
                {a.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Age" htmlFor="age">
              <input id="age" inputMode="numeric" className="input" value={age} placeholder="34" onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} />
            </Field>
            <Field label="Unit" htmlFor="age-unit">
              <select id="age-unit" className="input" value={ageUnit} onChange={(e) => setAgeUnit(e.target.value as typeof ageUnit)}>
                <option value="years">Years</option>
                <option value="months">Months</option>
                <option value="days">Days</option>
              </select>
            </Field>
            <Field label="Sex" htmlFor="sex">
              <select id="sex" className="input" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}>
                <option value="unknown">Unknown</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <Field
            label="Clinical note"
            htmlFor="note"
            hint={
              <div id="note-help" className="mt-1.5 flex justify-between gap-2 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1"><ShieldCheck aria-hidden className="size-3.5 text-emerald-600" /> Read to every hospital. No names, phone numbers or IDs.</span>
                <span className="kbd-num">{note.length}/160</span>
              </div>
            }
          >
            <textarea
              id="note"
              className="input min-h-24 resize-y py-2.5 leading-relaxed"
              maxLength={160}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby="note-help"
              aria-invalid={noteErrors.length > 0}
              placeholder="Drooping eyelids 2 hrs after bite. Given 10 vials ASV."
            />
          </Field>
          {noteErrors.map((m) => (
            <p key={m} role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{m}</p>
          ))}
          {preview?.warnings.map((m) => (
            <p key={m} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">{m}</p>
          ))}
        </Section>

        <div className="border-t border-line px-5 py-4 sm:px-6">
          <button
            type="button"
            aria-expanded={showPatient}
            onClick={() => setShowPatient((s) => !s)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-zinc-100"><Lock aria-hidden className="size-4 text-zinc-600" /></span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-zinc-900">Patient &amp; family details</span>
              <span className="block text-xs text-zinc-500">Private. Sent on WhatsApp only to the hospital that accepts. Never spoken on calls.</span>
            </span>
            <ChevronDown aria-hidden className={cx("size-4 text-zinc-400 transition", showPatient && "rotate-180")} />
          </button>
          {showPatient && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ["patient_name", "Patient name"],
                ["attendant_name", "Attendant name"],
                ["attendant_phone", "Attendant phone"],
              ] as const).map(([k, label]) => (
                <Field key={k} label={label} htmlFor={k}>
                  <input id={k} className="input" value={patient[k]} onChange={(e) => setPatient((p) => ({ ...p, [k]: e.target.value }))} />
                </Field>
              ))}
              <Field label="Attendant language" htmlFor="att-lang">
                <select id="att-lang" className="input" value={patient.attendant_language} onChange={(e) => setPatient((p) => ({ ...p, attendant_language: e.target.value }))}>
                  <option value="en">English</option>
                  <option value="kn">Kannada</option>
                  <option value="hi">Hindi</option>
                </select>
              </Field>
            </div>
          )}
        </div>

        <div className="grid gap-4 border-t border-line bg-zinc-50/60 px-5 py-5 sm:grid-cols-2 sm:items-end sm:px-6">
          <Field label="Search radius" htmlFor="radius">
            <select id="radius" className="input" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {[20, 40, 60, 80, 120].map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
          </Field>
          <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3">
            <span className="text-sm font-medium text-zinc-800">Run as simulation</span>
            <span className="relative inline-flex items-center">
              <input type="checkbox" checked={simulate} disabled={!props.bolnaReady} onChange={(e) => setSimulate(e.target.checked)} className="peer sr-only" />
              <span className="h-6 w-10 rounded-full bg-zinc-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
              <span className="absolute left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
            </span>
          </label>
          {!props.bolnaReady && (
            <p className="text-xs text-zinc-500 sm:col-span-2">Bolna isn&apos;t configured on this deployment, so referrals run as simulations.</p>
          )}
          {submitError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 sm:col-span-2">{submitError}</p>}
          <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-lg w-full sm:col-span-2">
            {submitting ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Starting calls…</> : willCall.length > 0 && ready ? `Find a bed · call ${willCall.length} hospitals` : "Find a bed"}
          </button>
          {missing && <p className="-mt-2 text-center text-xs text-zinc-500 sm:col-span-2">{missing} to continue.</p>}
        </div>
      </section>

      <aside aria-label="Call preview" aria-live="polite" className="space-y-4 xl:sticky xl:top-8">
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-50"><AudioLines aria-hidden className="size-4 text-brand-600" /></span>
            <h2 className="text-sm font-semibold">What hospitals will hear</h2>
            {loadingPreview && <Loader2 aria-label="Updating" className="ml-auto size-4 animate-spin text-zinc-400" />}
          </div>
          <div className="p-5">
            {!caseType && (
              <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                <Sparkles aria-hidden className="mx-auto mb-2 size-5 text-zinc-400" />
                Pick a case to see the exact words the voice agent will say, and which hospitals it will call.
              </div>
            )}
            {previewError && <p className="text-sm text-rose-700">{previewError}</p>}
            {caseType && !acuity && <p className="text-sm text-zinc-500">Set the acuity to see the full script.</p>}
            {preview?.spoken_summary && acuity && (
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white">AI</span>
                <blockquote className="rounded-2xl rounded-tl-sm bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 ring-1 ring-inset ring-line">
                  {preview.spoken_summary}
                </blockquote>
              </div>
            )}
            {preview?.spoken_summary && acuity && (
              <p className="mt-3 text-xs text-zinc-500">The agent introduces itself as an automated assistant for the doctor, discloses recording, and reads the answer back before recording it.</p>
            )}
          </div>
        </section>

        {preview && preview.eligible.length > 0 && (
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold">Hospitals to call</h2>
              <span className="text-xs text-zinc-500">{willCall.length} in parallel · {radius} km</span>
            </div>
            {!!preview.skipped_far && (
              <p className="border-b border-line bg-zinc-50 px-5 py-2 text-xs text-zinc-600">
                {preview.skipped_far} more {preview.skipped_far === 1 ? "hospital is" : "hospitals are"} over {preview.max_eta_minutes} min away and left out for a {acuity || "this"} patient.
              </p>
            )}
            <ol className="divide-y divide-line">
              {preview.eligible.map((e, i) => (
                <li key={e.facility_id} className={cx("flex gap-3 px-5 py-3", !e.will_call && "opacity-55")}>
                  <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", e.will_call ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500")}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900">{shortName(e.name)}</span>
                      <span className="kbd-num shrink-0 text-sm text-zinc-700">{e.eta_minutes} min</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1"><MapPin aria-hidden className="size-3" />{e.distance_km} km</span>
                      <span aria-hidden>·</span>
                      <span>{LANGUAGE_LABEL[e.call_language] ?? e.call_language}</span>
                      {e.rank_reasons.filter((r) => !r.endsWith("min away")).map((r) => (
                        <span key={r} className={cx("tag", r === "IVR line only" && "bg-amber-50 text-amber-800")}>{r}</span>
                      ))}
                      {!e.will_call && <span className="tag">next round</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {preview && preview.spoken_summary && preview.eligible.length === 0 && (
          <section className="card p-5">
            <p className="text-sm font-medium text-zinc-900">
              No hospital within {radius} km has {needs.map((n) => capByCode.get(n)?.label ?? n).join(" + ") || "these needs"}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {radius < 80 && <button type="button" className="btn btn-secondary" onClick={() => setRadius(80)}>Widen to 80 km</button>}
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
          </section>
        )}
      </aside>
    </form>
  );
}
