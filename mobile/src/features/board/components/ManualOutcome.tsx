import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ManualOutcomeInput } from '../../../api/referral.repository';
import type { AttemptView } from '../../../api/schema';
import BottomSheet from '../../../components/ui/BottomSheet';
import Button from '../../../components/ui/Button';
import FilterChip from '../../../components/ui/FilterChip';
import TextField from '../../../components/ui/TextField';
import { BED_LABEL, manualOutcomeReady, manualOutcomeStart } from '../../../lib/display';
import { phrase, t } from '../../../lib/i18n';
import theme from '../../../theme';

const OUTCOMES = [
  { value: 'accepted', label: phrase('Accepted') },
  { value: 'conditional', label: phrase('Accepted with a condition') },
  { value: 'declined', label: phrase('Declined') },
  { value: 'callback_later', label: phrase('Call back later') },
  { value: 'unclear', label: phrase('Unclear') },
] as const;
type OutcomeValue = (typeof OUTCOMES)[number]['value'];
const BEDS = Object.keys(BED_LABEL).filter((k) => k !== 'none' && k !== 'unknown');

/** Records what a desk said on a phone call the doctor made themselves. */
export default function ManualOutcome({
  attempt: a,
  onSave,
  onClose,
}: {
  attempt: AttemptView;
  onSave: (input: ManualOutcomeInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const start = manualOutcomeStart(a);
  const [outcome, setOutcome] = useState<OutcomeValue | ''>(start.outcome as OutcomeValue | '');
  const [bed, setBed] = useState(start.bed);
  const [ready, setReady] = useState(a.ready_in_minutes?.toString() ?? '');
  const [contact, setContact] = useState(a.contact_person ?? '');
  const [conditions, setConditions] = useState(a.conditions ?? '');
  const [reason, setReason] = useState(a.decline_reason ?? '');
  const [busy, setBusy] = useState(false);
  const accepted = outcome === 'accepted' || outcome === 'conditional';
  const complete = manualOutcomeReady(outcome, bed);

  const save = async () => {
    if (outcome === '') return;
    setBusy(true);
    const ok = await onSave({
      outcome,
      bed_type: accepted ? bed : null,
      ready_in_minutes: ready ? Number(ready) : null,
      contact_person: contact.trim() || null,
      conditions: outcome === 'conditional' ? conditions.trim() || null : null,
      decline_reason: outcome === 'declined' ? reason.trim() || null : null,
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={t('What did the desk tell you?')}
      footer={
        <>
          {complete ? null : <Text style={styles.hint}>{t('Choose what the desk said, and the bed type if they accepted.')}</Text>}
          <Button label={t('Save outcome')} loading={busy} disabled={!complete} onPress={save} testID="save-outcome" />
          <Button label={t('Cancel')} variant="text" onPress={onClose} />
        </>
      }
    >
      <View style={styles.form}>
        <Text style={styles.label}>{t('Outcome')}</Text>
        <View style={styles.chips}>
          {OUTCOMES.map((o) => (
            <FilterChip key={o.value} label={t(o.label)} selected={o.value === outcome} onPress={() => setOutcome(o.value)} />
          ))}
        </View>
        {accepted ? (
          <>
            <Text style={styles.label}>{t('Bed type')}</Text>
            <View style={styles.chips}>
              {BEDS.map((b) => (
                <FilterChip key={b} label={t(BED_LABEL[b] ?? b)} selected={b === bed} onPress={() => setBed(b)} />
              ))}
            </View>
            <TextField
              appearance="plain"
              label={t('Ready in (minutes)')}
              value={ready}
              onChangeText={(text) => setReady(text.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
          </>
        ) : null}
        <TextField appearance="plain" label={t('Contact person')} value={contact} onChangeText={setContact} />
        {outcome === 'conditional' ? (
          <TextField appearance="plain" label={t('Condition')} value={conditions} onChangeText={setConditions} />
        ) : null}
        {outcome === 'declined' ? <TextField appearance="plain" label={t('Reason')} value={reason} onChangeText={setReason} /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.space.m },
  label: { ...theme.type.captionStrong, color: theme.tint.ink },
  hint: { ...theme.type.caption, color: theme.tint.muted, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
});
