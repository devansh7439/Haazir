import { ShieldCheck } from "lucide-react";
import { cx } from "@/components/ui";
import { Field } from "./Field";
import { FormSection } from "./FormSection";
import { ACUITY, SEX } from "./options";
import type { Acuity, AgeUnit, Sex } from "./types";

/** One option of a segmented one-tap control. */
const segment = (on: boolean) =>
  cx(
    "flex min-h-10 cursor-pointer items-center justify-center rounded-lg text-sm font-medium transition",
    on ? "bg-white text-zinc-900 shadow-[0_1px_3px_rgba(16,24,40,0.12)]" : "text-zinc-600 hover:text-zinc-900",
  );

/**
 * Acuity (an explicit, required choice), age, sex and the clinical note that is read to every hospital. The note's
 * identifier errors come from the preview and block submitting.
 */
export function PatientSection(props: {
  acuity: Acuity | "";
  onAcuity: (a: Acuity) => void;
  age: string;
  onAge: (age: string) => void;
  ageUnit: AgeUnit;
  onAgeUnit: (u: AgeUnit) => void;
  sex: Sex;
  onSex: (s: Sex) => void;
  note: string;
  onNote: (note: string) => void;
  noteErrors: string[];
  warnings: string[];
}) {
  const { acuity, age, ageUnit, sex, note, noteErrors, warnings } = props;
  return (
    <FormSection title="Patient">
      <div role="radiogroup" aria-label="Acuity" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
        {ACUITY.map((a) => (
          <label key={a.value} className={cx(segment(acuity === a.value), "gap-2")}>
            <input type="radio" name="acuity" value={a.value} checked={acuity === a.value} onChange={() => props.onAcuity(a.value)} className="sr-only" />
            <span aria-hidden className={cx("size-2 rounded-full", a.dot)} />
            {a.label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age" htmlFor="age">
          <input id="age" inputMode="numeric" className="input" value={age} placeholder="34" onChange={(e) => props.onAge(e.target.value.replace(/\D/g, "").slice(0, 3))} />
        </Field>
        <Field label="Unit" htmlFor="age-unit">
          <select id="age-unit" className="input" value={ageUnit} onChange={(e) => props.onAgeUnit(e.target.value as AgeUnit)}>
            <option value="years">Years</option>
            <option value="months">Months</option>
            <option value="days">Days</option>
          </select>
        </Field>
      </div>
      {/* One tap instead of opening a dropdown. */}
      <div role="radiogroup" aria-label="Sex" className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1">
        {SEX.map((o) => (
          <label key={o.value} className={segment(sex === o.value)}>
            <input type="radio" name="sex" value={o.value} checked={sex === o.value} onChange={() => props.onSex(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
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
          onChange={(e) => props.onNote(e.target.value)}
          aria-describedby="note-help"
          aria-invalid={noteErrors.length > 0}
          placeholder="Drooping eyelids 2 hrs after bite. Given 10 vials ASV."
        />
      </Field>
      {noteErrors.map((m) => (
        <p key={m} role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{m}</p>
      ))}
      {warnings.map((m) => (
        <p key={m} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">{m}</p>
      ))}
    </FormSection>
  );
}
