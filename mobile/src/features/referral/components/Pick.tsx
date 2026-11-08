import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import SelectField from '../../../components/ui/SelectField';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** One optional question with its answers in a dropdown; "Not stated" puts it back to unanswered, so nothing is forced. */
export default function Pick({
  label,
  choices,
  value,
  onChange,
  testID,
}: {
  label: string;
  choices: ReadonlyArray<{ value: string; label: Parameters<typeof t>[0] }>;
  value: string;
  onChange: (value: string) => void;
  testID?: string;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      options={choices.map((c) => ({ value: c.value, label: t(c.label) }))}
      onChange={onChange}
      placeholder={t('Not stated')}
      clearable
      {...(testID ? { testID } : {})}
    />
  );
}

/** Two short questions side by side, each taking half the width. */
export function Pair({ children }: { children: ReactNode }) {
  return (
    <View style={styles.pair}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={styles.half}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: theme.space.m },
  half: { flex: 1, minWidth: 0 },
});
