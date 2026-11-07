import { ShieldCheck } from "lucide-react";
import { cx } from "@/components/ui";
import { Field } from "./Field";
import { ACUITY, AGE_UNITS, NOTE_MAX, SEX } from "./options";
import type { Acuity, AgeUnit, Sex } from "./types";

/** A grey track with a white thumb under the chosen option: one tap instead of a dropdown. */
export function Segmented<T extends string>(props: {
  name: string;
  label: string;
  value: T | "";
  options: ReadonlyArray<{ value: T; label: string; dot?: string }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={props.label} className={cx("seg", props.className)}>
      {props.options.map((o) => (
        <label key={o.value} className={cx("seg-item", props.value === o.value && "seg-item-on")}>
          <input type="radio" name={props.name} value={o.value} checked={props.value === o.value} onChange={() => props.onChange(o.value)} className="sr-only" />
          {o.dot && <span aria-hidden className="size-1.5 rounded-full" style={{ background: o.dot }} />}
          {o.label}
        </label>
      ))}
    </div>
  );
}

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
    <>
      <div className="grid gap-1.5">
        <span className="label mb-0">Acuity</span>
        <Segmented name="acuity" label="Acuity" value={acuity} options={ACUITY} onChange={props.onAcuity} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <label htmlFor="age" className="label mb-0">Age</label>
          <div className="flex gap-2">
            <input
              id="age"
              inputMode="numeric"
              className="input w-20 text-center"
              value={age}
              placeholder="34"
              onChange={(e) => props.onAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
            <Segmented name="age-unit" label="Age unit" value={ageUnit} options={AGE_UNITS} onChange={props.onAgeUnit} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <span className="label mb-0">Sex</span>
          <Segmented name="sex" label="Sex" value={sex} options={SEX} onChange={props.onSex} />
        </div>
      </div>
      <Field label="Clinical note" htmlFor="note">
        <textarea
          id="note"
          className="input min-h-24 resize-y py-2.5 leading-relaxed"
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => props.onNote(e.target.value)}
          aria-describedby="note-help"
          aria-invalid={noteErrors.length > 0}
          placeholder="Drooping eyelids 2 hrs after bite. Given 10 vials ASV."
        />
        <div id="note-help" className="mt-1.5 flex justify-between gap-2 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1"><ShieldCheck aria-hidden className="size-3.5 text-emerald-600" /> Read to every hospital. No names, phone numbers or IDs.</span>
          <span className="kbd-num w-14 shrink-0 text-right">{note.length}/{NOTE_MAX}</span>
        </div>
      </Field>
      {noteErrors.map((m) => (
        <p key={m} role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200">{m}</p>
      ))}
      {warnings.map((m) => (
        <p key={m} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">{m}</p>
      ))}
    </>
  );
}
