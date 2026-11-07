import { StyleSheet, Text, View } from 'react-native';
import FilterChip from '../../../components/ui/FilterChip';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** One question with its answers as pills; tapping the chosen one again clears it, so nothing is forced. */
export default function Pick({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: ReadonlyArray<{ value: string; label: Parameters<typeof t>[0] }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {choices.map((c) => (
          <FilterChip key={c.value} label={t(c.label)} selected={value === c.value} onPress={() => onChange(value === c.value ? '' : c.value)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.space.s },
  label: { ...theme.type.captionStrong, color: theme.tint.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
});
