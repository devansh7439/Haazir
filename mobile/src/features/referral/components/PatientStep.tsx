import type { Acuity, AgeUnit, Sex } from '../../../api/schema';
import { t } from '../../../lib/i18n';
import type { Clinical } from '../clinical.helper';
import type { Handover } from '../handover.helper';
import type { PatientFields } from '../referralOptions';
import ClinicalDetails from './ClinicalDetails';
import FormBlock from './FormBlock';
import { HandoverDetails } from './HandoverDetails';
import PatientDetails from './PatientDetails';
import { AgeSex, UrgencyPicker } from './PatientSection';

/** Step 1 of the form: who the patient is, how urgent it is, the condition now, the handover and the private details. */
export default function PatientStep(props: {
  age: string;
  onAge: (age: string) => void;
  ageUnit: AgeUnit;
  onAgeUnit: (unit: AgeUnit) => void;
  sex: Sex;
  onSex: (sex: Sex) => void;
  acuity: Acuity | '';
  onAcuity: (acuity: Acuity) => void;
  clinical: Clinical;
  onClinical: (clinical: Clinical) => void;
  handover: Handover;
  onHandover: (handover: Handover) => void;
  showPatient: boolean;
  onTogglePatient: () => void;
  patient: PatientFields;
  onPatient: (patient: PatientFields) => void;
}) {
  return (
    <>
      <FormBlock title={t('Age and sex')} hint={t('Approx is fine. It only helps match the right hospital.')}>
        <AgeSex age={props.age} onAge={props.onAge} ageUnit={props.ageUnit} onAgeUnit={props.onAgeUnit} sex={props.sex} onSex={props.onSex} />
      </FormBlock>
      <FormBlock title={t('How urgent?')}>
        <UrgencyPicker acuity={props.acuity} onAcuity={props.onAcuity} />
      </FormBlock>
      <FormBlock title={t('Condition now')} hint={t('What the receiving team asks first. Tap what applies; all optional.')}>
        <ClinicalDetails clinical={props.clinical} onChange={props.onClinical} />
      </FormBlock>
      <FormBlock title={t('Handover')} hint={t('Pregnancy, how it happened, infection risk, blood and consent. All optional.')}>
        <HandoverDetails handover={props.handover} female={props.sex !== 'male'} onChange={props.onHandover} />
      </FormBlock>
      <FormBlock title={t('Private details')} hint={t('Shared with a hospital only after it accepts, never before.')}>
        <PatientDetails open={props.showPatient} onToggle={props.onTogglePatient} patient={props.patient} onChange={props.onPatient} />
      </FormBlock>
    </>
  );
}
