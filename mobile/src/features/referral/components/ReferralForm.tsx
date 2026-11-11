import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Acuity, AgeUnit, Bootstrap, CaseTemplate, Draft, Referrer, Sex } from '../../../api/schema';
import Screen from '../../../components/ui/Screen';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { animateLayout } from '../../../lib/motion';
import { newRequestId } from '../../../lib/request-id';
import { getSettings } from '../../../lib/settings';
import { clinicalError, composeNote, EMPTY_CLINICAL, extraLimit, factsBody, type Clinical } from '../clinical.helper';
import { isValidAge, REVIEW_STEP, sendHint, STEP_CARD, STEPS, stepBlocker } from '../referral.helper';
import { EMPTY_PATIENT, type PatientFields } from '../referralOptions';
import { useOrigin } from '../hooks/useOrigin';
import { useReferralPreview } from '../hooks/useReferralPreview';
import { useReferralSubmit } from '../hooks/useReferralSubmit';
import { EMPTY_HANDOVER, handoverBody, handoverError, type Handover } from '../handover.helper';
import CallPreview from './CallPreview';
import CaseStep from './CaseStep';
import DraftBanner from './DraftBanner';
import FormFooter from './FormFooter';
import NeedsPicker from './NeedsPicker';
import NoReferrer from './NoReferrer';
import PatientStep from './PatientStep';
import ReviewChecklist from './ReviewChecklist';
import SectionCard from './SectionCard';
import StepBar from './StepBar';
import WhereStep from './WhereStep';

/**
 * The "Find a bed" form, one step at a time with Back and Next: the patient, the case, what the hospital must have, where
 * to search from, then a review that lists the nearest capable hospitals and sends.
 */
export default function ReferralForm({
  boot,
  referrer,
  onCreated,
  onBack,
  draft,
  header,
}: {
  boot: Bootstrap;
  /** The doctor the referral is placed for: the signed-in doctor, or the one a coordinator or admin chose. */
  referrer: Referrer | null;
  onCreated: (id: string) => void;
  onBack: () => void;
  draft?: Draft | null;
  header?: ReactNode;
}) {
  const parsed = draft?.parsed;
  const [step, setStep] = useState(0);
  const [caseType, setCaseType] = useState(parsed?.case_type ?? '');
  const [needs, setNeeds] = useState<string[]>(parsed?.required_capabilities ?? []);
  const [acuity, setAcuity] = useState<Acuity | ''>(parsed?.acuity ?? '');
  const [age, setAge] = useState(parsed?.age_value != null ? String(parsed.age_value) : '');
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(parsed?.age_unit ?? 'years');
  const [sex, setSex] = useState<Sex>(parsed?.sex ?? 'unknown');
  // The note hospitals hear is built from the taps on the patient page plus the doctor's own words.
  const [clinical, setClinical] = useState<Clinical>(EMPTY_CLINICAL);
  const [handover, setHandover] = useState<Handover>(EMPTY_HANDOVER);
  const [extra, setExtra] = useState(parsed?.note ?? '');
  const [radius, setRadius] = useState(() => getSettings().radiusKm);
  const [showPatient, setShowPatient] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [patient, setPatient] = useState<PatientFields>(EMPTY_PATIENT);
  // One id per form: a double tap or a retry after a network error reuses it, so hospitals are never called twice
  // for the same patient.
  const [requestId] = useState(newRequestId);
  const { submitting, submitError, send } = useReferralSubmit(onCreated);
  const location = useOrigin();
  // A doctor who always searches from where they stand turns that on once in Account.
  useEffect(() => {
    if (getSettings().useLocation) void location.enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the form opens
  }, []);

  const pick = (template: CaseTemplate) => {
    setCaseType(template.case_type);
    setNeeds(template.default_capabilities);
    setSearching(false);
    setQuery('');
  };
  const toggleNeed = (code: string) => setNeeds((all) => (all.includes(code) ? all.filter((c) => c !== code) : [...all, code]));

  const note = composeNote(clinical, extra);
  const body = useMemo(
    () => ({
      referrer_id: referrer?.id ?? '',
      case_type: caseType,
      required_capabilities: needs,
      acuity: acuity || 'critical',
      age_value: age === '' ? null : Number(age),
      age_unit: ageUnit,
      sex,
      note: note.trim() || null,
      ...factsBody(clinical),
      ...handoverBody(handover),
      transport: 'ambulance' as const,
      search_radius_km: radius,
      ...(location.origin ? { origin_lat: location.origin.lat, origin_lng: location.origin.lng } : {}),
    }),
    [referrer?.id, caseType, needs, acuity, age, ageUnit, sex, note, clinical, handover, radius, location.origin],
  );
  const { preview, error: previewError, loading } = useReferralPreview(referrer ? body : {}, referrer ? caseType : '');

  const noteErrors = preview?.errors ?? [];
  const willCall = preview?.eligible.filter((e) => e.will_call) ?? [];
  const ageOk = isValidAge(age);
  const readingsError = clinicalError(clinical) ?? handoverError(handover);
  const blockers = STEPS.map((_, index) =>
    stepBlocker(index, { caseType, acuity, needs, ageOk, clinicalError: readingsError, noteError: noteErrors[0] ?? null }),
  );
  const complete = blockers.every((blocker) => !blocker);
  const canSubmit = !!referrer && complete && willCall.length > 0 && !submitting && boot.bolna_ready;
  const onReview = step === REVIEW_STEP;

  const goTo = (next: number) => {
    animateLayout();
    setSearching(false);
    setQuery('');
    setStep(next);
  };

  async function submit() {
    if (!canSubmit) return;
    const filled = showPatient || patient.patient_name || patient.attendant_phone;
    await send({
      ...body,
      draft_id: draft?.id,
      client_request_id: requestId,
      patient: filled ? { ...patient, attendant_language: patient.attendant_language || null } : undefined,
    });
  }

  if (!referrer) return <NoReferrer onBack={onBack} />;

  const blocker = blockers[step] ?? null;
  const card = STEP_CARD[step] ?? STEP_CARD[0]!;
  const hint = onReview
    ? sendHint({ missing: blockers.find(Boolean) ?? null, hasPreview: !!preview, willCall: willCall.length, callsReady: boot.bolna_ready })
    : blocker;

  return (
    // Keyed by step so each step opens scrolled to its top.
    <Screen
      key={step}
      testID="new-referral"
      header={
        <ScreenHeader
          onBack={onBack}
          title={t('Find a bed')}
          subtitle={t('Referring as {name}', {
            name: `${shortName(referrer.name)}${referrer.facility ? ` · ${shortName(referrer.facility)}` : ''}`,
          })}
          onSearch={
            step === 1
              ? () => {
                  animateLayout();
                  setSearching((open) => !open);
                  setQuery('');
                }
              : undefined
          }
          searching={searching}
        />
      }
      footer={
        <FormFooter
          step={step}
          onReview={onReview}
          submitError={submitError}
          submitting={submitting}
          canSubmit={canSubmit}
          hint={hint}
          nextBlocked={!!blocker}
          onPrevious={() => goTo(step - 1)}
          onNext={() => goTo(step + 1)}
          onSubmit={submit}
        />
      }
    >
      {step === 0 ? header : null}
      {draft && step === 0 ? <DraftBanner draft={draft} /> : null}

      <StepBar
        steps={STEPS.map((title, index) => ({ title: t(title), done: !blockers[index] && index < step }))}
        current={step}
        onJump={goTo}
      />

      <SectionCard step={step + 1} title={t(card.title)} hint={t(card.hint)}>
        {step === 0 ? (
          <PatientStep
            age={age}
            onAge={setAge}
            ageUnit={ageUnit}
            onAgeUnit={setAgeUnit}
            sex={sex}
            onSex={setSex}
            acuity={acuity}
            onAcuity={setAcuity}
            clinical={clinical}
            onClinical={setClinical}
            handover={handover}
            onHandover={setHandover}
            showPatient={showPatient}
            onTogglePatient={() => {
              animateLayout();
              setShowPatient((open) => !open);
            }}
            patient={patient}
            onPatient={setPatient}
          />
        ) : null}

        {step === 1 ? (
          <CaseStep
            templates={boot.templates}
            caseType={caseType}
            onPick={pick}
            searching={searching}
            query={query}
            onQuery={setQuery}
            extra={extra}
            onExtra={setExtra}
            noteErrors={noteErrors}
            noteMax={extraLimit(clinical)}
            warnings={preview?.warnings ?? []}
          />
        ) : null}

        {step === 2 ? <NeedsPicker capabilities={boot.capabilities} needs={needs} onToggle={toggleNeed} /> : null}

        {step === 3 ? <WhereStep location={location} radius={radius} onRadius={setRadius} /> : null}

        {onReview ? (
          <ReviewChecklist
            items={[
              { label: t('Case chosen'), ok: !!caseType },
              { label: t('Needs added'), ok: needs.length > 0 || caseType === 'other' },
              { label: t('Urgency set'), ok: !!acuity },
              { label: t('Hospitals found'), ok: willCall.length > 0 },
              { label: t('Calls are on'), ok: boot.bolna_ready },
            ]}
          />
        ) : null}
      </SectionCard>

      {onReview ? <CallPreview preview={preview} loading={loading} error={previewError} /> : null}
    </Screen>
  );
}
