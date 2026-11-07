import { ShieldCheck } from "lucide-react";
import { Field } from "./Field";
import { Segmented } from "./PatientSection";
import { handoverValid, TREATMENT_MAX } from "./handover";
import { BLOOD_GROUPS, INFECTIOUS, MECHANISMS, TRI } from "./options";
import type { HandoverFields, Sex } from "./types";

/**
 * Optional handover for the receiving doctor. Pregnancy, how it happened, infection risk and blood need are read to every
 * hospital; treatment given and blood group are told only to a desk that asks. Nothing here identifies the patient.
 */
export function HandoverSection(props: { handover: HandoverFields; sex: Sex; onChange: (h: HandoverFields) => void }) {
  const { handover, sex } = props;
  const set = <K extends keyof HandoverFields>(key: K, value: HandoverFields[K]) => props.onChange({ ...handover, [key]: value });
  return (
    <>
      {sex !== "male" && (
        <Field label="Pregnancy (weeks)" htmlFor="pregnancy-weeks">
          <input
            id="pregnancy-weeks"
            inputMode="numeric"
            className="input w-20 text-center"
            value={handover.pregnancy_weeks}
            placeholder="34"
            onChange={(e) => set("pregnancy_weeks", e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </Field>
      )}
      {!handoverValid(handover) && <p role="alert" className="text-sm text-rose-700">Pregnancy is 1–45 weeks. An out-of-range value is not sent.</p>}
      <div className="grid gap-1.5">
        <span className="label mb-0">How it happened</span>
        <Segmented name="mechanism" label="How it happened" value={handover.trauma_mechanism} options={MECHANISMS} onChange={(v) => set("trauma_mechanism", v)} />
      </div>
      <div className="grid gap-1.5">
        <span className="label mb-0">Infection risk</span>
        <Segmented name="infectious" label="Infection risk" value={handover.infectious_risk} options={INFECTIOUS} onChange={(v) => set("infectious_risk", v)} />
      </div>
      <div className="grid gap-1.5">
        <span className="label mb-0">Needs blood</span>
        <Segmented name="blood-needed" label="Needs blood" value={handover.blood_needed} options={TRI} onChange={(v) => set("blood_needed", v)} />
      </div>
      <div className="grid gap-1.5">
        <span className="label mb-0">Blood group</span>
        <Segmented name="blood-group" label="Blood group" value={handover.blood_group} options={BLOOD_GROUPS} onChange={(v) => set("blood_group", v)} />
      </div>
      <Field label="Treatment given so far" htmlFor="treatment">
        <textarea
          id="treatment"
          className="input min-h-20 resize-y py-2.5 leading-relaxed"
          maxLength={TREATMENT_MAX}
          value={handover.treatment_given}
          onChange={(e) => set("treatment_given", e.target.value)}
          placeholder="IV fluids, tetanus toxoid, 10 vials ASV"
        />
        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-zinc-500">
          <ShieldCheck aria-hidden className="size-3.5 text-emerald-600" /> Told to a desk that asks. No names, phone numbers or IDs.
        </p>
      </Field>
    </>
  );
}
