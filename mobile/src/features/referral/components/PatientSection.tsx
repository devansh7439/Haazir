import { StyleSheet, View } from 'react-native';
import type { Acuity, AgeUnit, Sex } from '../../../api/schema';
import OptionTile from '../../../components/ui/OptionTile';
import SelectField from '../../../components/ui/SelectField';
import TextField from '../../../components/ui/TextField';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';
import { isValidAge } from '../referral.helper';
import { ACUITY, AGE_UNIT, NOTE_MAX, SEX } from '../referralOptions';

const segments = <V extends string>(options: readonly { value: V; label: Parameters<typeof t>[0] }[]) =>
  options.map((option) => ({ value: option.value, label: t(option.label) }));

/** How urgent: three big tiles, each with its own colour dot and the word. */
export function UrgencyPicker({ acuity, onAcuity }: { acuity: Acuity | ''; onAcuity: (acuity: Acuity) => void }) {
  return (
    <View style={styles.row}>
      {ACUITY.map((option) => (
        <OptionTile
          key={option.value}
          testID={`acuity-${option.value}`}
          label={t(option.label)}
          dot={theme.acuity[option.value]}
          selected={acuity === option.value}
          onPress={() => onAcuity(option.value)}
          layout="row"
        />
      ))}
    </View>
  );
}

/** Age with its unit beside it, and sex: a number and two dropdowns. */
export function AgeSex(props: {
  age: string;
  onAge: (age: string) => void;
  ageUnit: AgeUnit;
  onAgeUnit: (unit: AgeUnit) => void;
  sex: Sex;
  onSex: (sex: Sex) => void;
}) {
  const ageBad = !isValidAge(props.age);
  return (
    <View style={styles.stack}>
      <View style={styles.ageRow}>
        <View style={styles.half}>
          <TextField
            appearance="plain"
            label={t('Age')}
            value={props.age}
            onChangeText={props.onAge}
            keyboardType="number-pad"
            placeholder={t('e.g. 34')}
            error={ageBad ? t('Enter a whole number') : null}
            testID="age"
          />
        </View>
        <View style={styles.half}>
          <SelectField label={t('Unit')} value={props.ageUnit} options={segments(AGE_UNIT)} onChange={(v) => props.onAgeUnit(v as AgeUnit)} testID="age-unit" />
        </View>
      </View>
      <SelectField label={t('Sex')} value={props.sex} options={segments(SEX)} onChange={(v) => props.onSex(v as Sex)} testID="sex" />
    </View>
  );
}

/** The short note hospitals hear. It is spoken, so it must not name anyone; the preview says when it does. */
export function NoteField(props: { note: string; onNote: (note: string) => void; noteErrors: string[]; max?: number }) {
  return (
    <TextField
      appearance="plain"
      value={props.note}
      onChangeText={props.onNote}
      maxLength={props.max ?? NOTE_MAX}
      showCount
      multiline
      placeholder={t('Symptoms, time since onset, treatment given. No names or phone numbers.')}
      accessibilityLabel={t('Note for the hospital')}
      error={props.noteErrors[0] ?? null}
      testID="note"
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.space.s },
  stack: { gap: theme.space.m },
  ageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.m },
  half: { flex: 1, minWidth: 0 },
});
