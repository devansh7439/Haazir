import { StyleSheet, View } from 'react-native';
import SelectField from '../../../components/ui/SelectField';
import TextField from '../../../components/ui/TextField';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';
import { BLOOD_GROUPS, CONSENT, INFECTION, MECHANISM, REASON, pregnancyValid, type Handover } from '../handover.helper';
import { YES_NO } from '../clinical.helper';
import Pick, { Pair } from './Pick';

/**
 * What the receiving doctor asks after the vitals: pregnancy, how it happened, infection risk and blood. All optional; the
 * server reads these to hospitals as structured facts, not in the note.
 */
export function HandoverDetails({
  handover,
  female,
  onChange,
}: {
  handover: Handover;
  female: boolean;
  onChange: (handover: Handover) => void;
}) {
  const set = <K extends keyof Handover>(key: K, value: Handover[K]) => onChange({ ...handover, [key]: value });
  return (
    <View style={styles.wrap}>
      {female && (
        <TextField
          appearance="plain"
          label={t('Pregnancy (weeks)')}
          value={handover.pregnancy}
          onChangeText={(v) => set('pregnancy', v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder={t('e.g. 34')}
          error={pregnancyValid(handover.pregnancy) ? null : t('From 1 to 45')}
          testID="pregnancy"
        />
      )}
      <Pick label={t('How it happened')} choices={MECHANISM} value={handover.mechanism} onChange={(v) => set('mechanism', v)} />
      <Pick label={t('Infection risk')} choices={INFECTION} value={handover.infection} onChange={(v) => set('infection', v)} />
      <Pair>
        <Pick label={t('Needs blood')} choices={YES_NO} value={handover.bloodNeeded} onChange={(v) => set('bloodNeeded', v)} />
        <SelectField
          label={t('Blood group')}
          value={handover.bloodGroup}
          options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
          onChange={(v) => set('bloodGroup', v)}
          placeholder={t('Not stated')}
          clearable
        />
      </Pair>
      <Pick label={t('Consent to the transfer')} choices={CONSENT} value={handover.consent} onChange={(v) => set('consent', v)} />
      <Pick label={t('Reason for transfer')} choices={REASON} value={handover.reason} onChange={(v) => set('reason', v)} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: theme.space.l } });
