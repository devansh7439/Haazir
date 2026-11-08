import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReferralRepository } from '../../../api/referral.repository';
import type { Acuity, AgeUnit, Bootstrap, CaseTemplate, Draft, Referrer, Sex } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import FilterChip from '../../../components/ui/FilterChip';
import Icon from '../../../components/ui/Icon';
import Screen from '../../../components/ui/Screen';
import SearchField from '../../../components/ui/SearchField';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import SwitchRow from '../../../components/ui/SwitchRow';
import { shortName } from '../../../lib/display';
import { phrase, t } from '../../../lib/i18n';
import { animateLayout } from '../../../lib/motion';
import { newRequestId } from '../../../lib/request-id';
import { matches } from '../../../lib/search';
import { getSettings } from '../../../lib/settings';
import theme from '../../../theme';
import { clinicalError, composeNote, EMPTY_CLINICAL, extraLimit, factsBody, type Clinical } from '../clinical.helper';
import { isValidAge, REVIEW_STEP, sendHint, STEPS, stepBlocker } from '../referral.helper';
import { EMPTY_PATIENT, RADII_KM, type PatientFields } from '../referralOptions';
import { useOrigin } from '../hooks/useOrigin';
import { useReferralPreview } from '../hooks/useReferralPreview';
import CallPreview from './CallPreview';
import CasePicker from './CasePicker';
import ClinicalDetails from './ClinicalDetails';
import { HandoverDetails } from './HandoverDetails';
import { EMPTY_HANDOVER, handoverBody, handoverError, type Handover } from '../handover.helper';
import FormBlock from './FormBlock';
import NeedsPicker from './NeedsPicker';
import PatientDetails from './PatientDetails';
import ReviewChecklist from './ReviewChecklist';
import SectionCard from './SectionCard';
import { AgeSex, NoteField, UrgencyPicker } from './PatientSection';
import StepBar from './StepBar';

/** What each step's card is called, and the line of help under it. */
const STEP_CARD = [
  { title: phrase('Patient'), hint: phrase('Hospitals hear all of this on the call except the private details.') },
  { title: phrase('Case'), hint: phrase('Hospitals hear the case and your note on the call.') },
  { title: phrase('What must the hospital have?'), hint: phrase('Filled from the case. Tap to change.') },
  { title: phrase('Where to search'), hint: phrase('Hospitals are ranked by distance from where you search.') },
  { title: phrase('Review and send'), hint: phrase('Haazir phones every capable hospital at once.') },
];

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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const location = useOrigin();
  const here = !!location.origin || location.busy;
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
  const searchText = query.trim();
  const found = searchText ? boot.templates.filter((template) => matches(searchText, template.label)) : [];
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
    setSubmitting(true);
    setSubmitError(null);
    try {
      const filled = showPatient || patient.patient_name || patient.attendant_phone;
      const created = await ReferralRepository.create({
        ...body,
        draft_id: draft?.id,
        client_request_id: requestId,
        patient: filled ? { ...patient, attendant_language: patient.attendant_language || null } : undefined,
      });
      onCreated(created.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('Could not start the referral'));
      setSubmitting(false);
    }
  }

  if (!referrer) {
    return (
      <Screen testID="new-referral" header={<ScreenHeader title={t('New referral')} onBack={onBack} />}>
        <Banner
          tone="warning"
          title={t('No referring doctor')}
          body={t('No referring doctor is set up for this account. Ask an admin to add one.')}
        />
      </Screen>
    );
  }

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
        <>
          {submitError ? <Banner tone="alert" title={submitError} /> : null}
          <View style={styles.nav}>
            <View style={styles.grow}>
              {step > 0 ? <Button label={t('Previous')} icon="back" variant="secondary" onPress={() => goTo(step - 1)} testID="step-back" /> : null}
            </View>
            <View style={styles.grow}>
              {onReview ? (
                <Button label={t('Find a bed')} icon="phone-call" loading={submitting} disabled={!canSubmit} onPress={submit} testID="find-a-bed" />
              ) : (
                <Button label={t('Next')} disabled={!!blocker} onPress={() => goTo(step + 1)} testID="step-next" />
              )}
            </View>
          </View>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </>
      }
    >
      {step === 0 ? header : null}
      {draft && step === 0 ? (
        <Banner
          tone="info"
          title={t('Filled from your WhatsApp')}
          body={`${draft.parsed.matched.length ? `${t('Understood: {cases}.', { cases: draft.parsed.matched.join(', ') })} ` : ''}${t('Check every field before you start.')}${
            draft.parsed.note_dropped ? ` ${t('The note was left out because it may contain a name or number.')}` : ''
          }`}
        />
      ) : null}

      <StepBar
        steps={STEPS.map((title, index) => ({ title: t(title), done: !blockers[index] && index < step }))}
        current={step}
        onJump={goTo}
      />

      <SectionCard step={step + 1} title={t(card.title)} hint={t(card.hint)}>
        {step === 0 ? (
          <>
            <FormBlock title={t('Age and sex')} hint={t('Approx is fine. It only helps match the right hospital.')}>
              <AgeSex age={age} onAge={setAge} ageUnit={ageUnit} onAgeUnit={setAgeUnit} sex={sex} onSex={setSex} />
            </FormBlock>
            <FormBlock title={t('How urgent?')}>
              <UrgencyPicker acuity={acuity} onAcuity={setAcuity} />
            </FormBlock>
            <FormBlock title={t('Condition now')} hint={t('What the receiving team asks first. Tap what applies; all optional.')}>
              <ClinicalDetails clinical={clinical} onChange={setClinical} />
            </FormBlock>
            <FormBlock title={t('Handover')} hint={t('Pregnancy, how it happened, infection risk, blood and consent. All optional.')}>
              <HandoverDetails handover={handover} female={sex !== 'male'} onChange={setHandover} />
            </FormBlock>
            <FormBlock title={t('Private details')} hint={t('Shared with a hospital only after it accepts, never before.')}>
              <PatientDetails
                open={showPatient}
                onToggle={() => {
                  animateLayout();
                  setShowPatient((open) => !open);
                }}
                patient={patient}
                onChange={setPatient}
              />
            </FormBlock>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <FormBlock title={t('What is the case?')}>
              {searching ? (
                <SearchField value={query} onChangeText={setQuery} placeholder={t('Search cases, such as snake or stroke')} testID="case-search" />
              ) : null}
              {searchText ? (
                found.length > 0 ? (
                  <View style={styles.found}>
                    {found.map((template) => (
                      <Pressable key={template.case_type} accessibilityRole="button" onPress={() => pick(template)} style={styles.foundRow}>
                        <Text style={styles.foundLabel}>{template.label}</Text>
                        <Icon name="chevron-down" size={theme.size.icon} color={theme.color.textTertiary} />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.hint}>{t('Nothing found for “{query}”', { query: query.trim() })}</Text>
                )
              ) : (
                <CasePicker templates={boot.templates} caseType={caseType} onPick={pick} />
              )}
            </FormBlock>
            <FormBlock title={t('Anything else?')} hint={t('Optional. Added to the note. No names or phone numbers.')}>
              <NoteField note={extra} onNote={setExtra} noteErrors={noteErrors} max={extraLimit(clinical)} />
              {(preview?.warnings ?? []).map((warning) => (
                <Banner key={warning} tone="warning" title={warning} />
              ))}
            </FormBlock>
          </>
        ) : null}

        {step === 2 ? <NeedsPicker capabilities={boot.capabilities} needs={needs} onToggle={toggleNeed} /> : null}

        {step === 3 ? (
          <>
            <FormBlock title={t('Where from?')}>
              <SwitchRow
                title={t('Use my current location')}
                subtitle={here && !location.busy ? t('Using this phone’s position.') : t('Otherwise the search starts from your centre.')}
                value={here}
                disabled={location.busy}
                onValueChange={(on) => (on ? void location.enable() : location.disable())}
              />
              {location.error ? <Banner tone="warning" title={location.error} /> : null}
            </FormBlock>
            <FormBlock title={t('Match radius')} hint={t('How far from there to look for hospitals.')}>
              <View style={styles.chips}>
                {RADII_KM.map((km) => (
                  <FilterChip key={km} label={t('{km} km', { km })} selected={km === radius} onPress={() => setRadius(km)} />
                ))}
              </View>
            </FormBlock>
          </>
        ) : null}

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

const styles = StyleSheet.create({
  hint: { ...theme.type.caption, color: theme.tint.muted, textAlign: 'center' },
  nav: { flexDirection: 'row', gap: theme.space.s },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
  found: { borderRadius: theme.radius.tile, backgroundColor: theme.color.surface, borderWidth: 1.5, borderColor: theme.color.border },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: theme.space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.tint.hairline,
  },
  foundLabel: { ...theme.type.body, flex: 1, color: theme.color.textPrimary },
});
