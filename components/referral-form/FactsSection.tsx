import { Field } from "./Field";
import { Segmented } from "./PatientSection";
import { factsValid } from "./facts";
import { AIRWAY, PAYERS, TRI } from "./options";
import type { FactFields } from "./types";

/**
 * Optional bedside status and cover. Airway, oxygen saturation and G C S are read to every hospital; payment and the
 * medico-legal flag are only told to a desk that asks. Nothing here identifies the patient.
 */
export function FactsSection(props: { facts: FactFields; onChange: (f: FactFields) => void }) {
  const { facts } = props;
  const set = <K extends keyof FactFields>(key: K, value: FactFields[K]) => props.onChange({ ...facts, [key]: value });
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 3);
  return (
    <>
      <div className="grid gap-1.5">
        <span className="label mb-0">Airway</span>
        <Segmented name="airway" label="Airway" value={facts.airway} options={AIRWAY} onChange={(v) => set("airway", v)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
        <Field label="SpO₂ %" htmlFor="spo2">
          <input id="spo2" inputMode="numeric" className="input w-20 text-center" value={facts.spo2} placeholder="88" onChange={(e) => set("spo2", digits(e.target.value))} />
        </Field>
        <Field label="GCS (3–15)" htmlFor="gcs">
          <input id="gcs" inputMode="numeric" className="input w-20 text-center" value={facts.gcs} placeholder="9" onChange={(e) => set("gcs", digits(e.target.value))} />
        </Field>
        <div className="grid gap-1.5">
          <span className="label mb-0">On oxygen</span>
          <Segmented name="on-oxygen" label="On oxygen" value={facts.on_oxygen} options={TRI} onChange={(v) => set("on_oxygen", v)} />
        </div>
      </div>
      {!factsValid(facts) && <p role="alert" className="text-sm text-rose-700">SpO₂ is 0–100 and GCS is 3–15. Out-of-range values are not sent.</p>}
      <div className="grid gap-1.5">
        <span className="label mb-0">Payment</span>
        <Segmented name="payer" label="Payment" value={facts.payer} options={PAYERS} onChange={(v) => set("payer", v)} />
      </div>
      <div className="grid gap-1.5">
        <span className="label mb-0">Medico-legal case</span>
        <Segmented name="medico-legal" label="Medico-legal case" value={facts.medico_legal} options={TRI} onChange={(v) => set("medico_legal", v)} />
      </div>
    </>
  );
}
