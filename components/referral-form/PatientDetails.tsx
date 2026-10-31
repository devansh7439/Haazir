import { ChevronDown, Lock } from "lucide-react";
import { cx } from "@/components/ui";
import { Field } from "./Field";
import type { PatientFields } from "./types";

const TEXT_FIELDS = [
  ["patient_name", "Patient name"],
  ["attendant_name", "Attendant name"],
  ["attendant_phone", "Attendant phone"],
] as const;

/** The private patient and family details, collapsed by default. Sent only to the accepting hospital, never spoken. */
export function PatientDetails(props: { open: boolean; onToggle: () => void; patient: PatientFields; onChange: (p: PatientFields) => void }) {
  const { open, patient } = props;
  const set = (key: keyof PatientFields, value: string) => props.onChange({ ...patient, [key]: value });
  return (
    <div className="border-t border-line px-5 py-4 sm:px-6">
      <button type="button" aria-expanded={open} onClick={props.onToggle} className="flex w-full items-center gap-3 text-left">
        <span className="grid size-8 place-items-center rounded-lg bg-zinc-100"><Lock aria-hidden className="size-4 text-zinc-600" /></span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-zinc-900">Patient &amp; family details</span>
          <span className="block text-xs text-zinc-500">Private. Sent on WhatsApp only to the hospital that accepts. Never spoken on calls.</span>
        </span>
        <ChevronDown aria-hidden className={cx("size-4 text-zinc-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map(([k, label]) => (
            <Field key={k} label={label} htmlFor={k}>
              <input id={k} className="input" value={patient[k]} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
          <Field label="Attendant language" htmlFor="att-lang">
            <select id="att-lang" className="input" value={patient.attendant_language} onChange={(e) => set("attendant_language", e.target.value)}>
              <option value="en">English</option>
              <option value="kn">Kannada</option>
              <option value="hi">Hindi</option>
            </select>
          </Field>
        </div>
      )}
    </div>
  );
}
