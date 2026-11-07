import { ArrowLeft } from "lucide-react";
import { FactsSection } from "./FactsSection";
import { FormSection } from "./FormSection";
import { HandoverSection } from "./HandoverSection";
import { PatientDetails } from "./PatientDetails";
import { PatientSection } from "./PatientSection";
import { TransferSection } from "./TransferSection";
import type { Acuity, AgeUnit, FactFields, HandoverFields, PatientFields, Sex, TransferFields } from "./types";

/** The second page of the full form: the patient, then the optional facts, handover, consent and private details. */
export function PatientPage(props: {
  acuity: Acuity | "";
  onAcuity: (a: Acuity) => void;
  age: string;
  onAge: (v: string) => void;
  ageUnit: AgeUnit;
  onAgeUnit: (u: AgeUnit) => void;
  sex: Sex;
  onSex: (s: Sex) => void;
  note: string;
  onNote: (v: string) => void;
  noteErrors: string[];
  warnings: string[];
  facts: FactFields;
  onFacts: (f: FactFields) => void;
  handover: HandoverFields;
  onHandover: (h: HandoverFields) => void;
  transfer: TransferFields;
  onTransfer: (t: TransferFields) => void;
  showPatient: boolean;
  onTogglePatient: () => void;
  patient: PatientFields;
  onPatient: (p: PatientFields) => void;
  onBack: () => void;
}) {
  return (
    <>
      <FormSection step={1} title="Patient" done={!!props.acuity}>
        <PatientSection
          acuity={props.acuity}
          onAcuity={props.onAcuity}
          age={props.age}
          onAge={props.onAge}
          ageUnit={props.ageUnit}
          onAgeUnit={props.onAgeUnit}
          sex={props.sex}
          onSex={props.onSex}
          note={props.note}
          onNote={props.onNote}
          noteErrors={props.noteErrors}
          warnings={props.warnings}
        />
      </FormSection>
      <FormSection step={2} title="Bedside status and cover" hint="Optional. Airway, SpO₂ and GCS are read to every hospital; payment and medico-legal are told only if a desk asks.">
        <FactsSection facts={props.facts} onChange={props.onFacts} />
      </FormSection>
      <FormSection step={3} title="Handover" hint="Optional. Pregnancy, how it happened, infection risk and blood need are read to every hospital; treatment given and blood group are told only if a desk asks.">
        <HandoverSection handover={props.handover} sex={props.sex} onChange={props.onHandover} />
      </FormSection>
      <FormSection step={4} title="Transfer consent" hint="Optional. Kept on the referral and printed on the referral slip.">
        <TransferSection transfer={props.transfer} onChange={props.onTransfer} />
      </FormSection>
      <FormSection step={5} title="Private details" hint="Optional." last>
        <PatientDetails open={props.showPatient} onToggle={props.onTogglePatient} patient={props.patient} onChange={props.onPatient} />
      </FormSection>
      <div className="mt-8">
        <button type="button" onClick={props.onBack} className="btn btn-secondary">
          <ArrowLeft aria-hidden className="size-4" /> Back to case
        </button>
      </div>
    </>
  );
}
