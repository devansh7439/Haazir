import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../lib/i18n';
import theme from '../../theme';
import BottomSheet from './BottomSheet';
import Icon from './Icon';

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Shown while nothing is picked. */
  placeholder?: string;
  /** Adds a first row that sets the value back to empty, for questions the doctor may leave unanswered. */
  clearable?: boolean;
  testID?: string;
};

/** A question with one answer, as a single line that opens a list of answers: a dropdown, so five questions take five lines instead of fifteen rows of pills. */
export default function SelectField({ label, value, options, onChange, placeholder, clearable = false, testID }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder ?? t('Not stated')}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.box, pressed && styles.boxPressed]}
      >
        <Text numberOfLines={2} style={[styles.value, !current && styles.placeholder]}>
          {current?.label ?? placeholder ?? t('Not stated')}
        </Text>
        <Icon name="chevron-down" size={theme.size.iconSmall} color={theme.color.textSecondary} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View accessibilityRole="radiogroup" style={styles.list}>
          {clearable ? <Row label={t('Not stated')} selected={!current} muted onPress={() => pick('')} /> : null}
          {options.map((o) => (
            <Row key={o.value} label={o.label} selected={o.value === value} onPress={() => pick(o.value)} />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

function Row({ label, selected, muted = false, onPress }: { label: string; selected: boolean; muted?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.boxPressed]}
    >
      <Text style={[styles.rowText, muted && styles.placeholder, selected && styles.rowTextSelected]}>{label}</Text>
      {selected ? <Icon name="check" size={theme.size.iconSmall} color={theme.color.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0 },
  label: { ...theme.type.captionStrong, color: theme.tint.ink, marginBottom: theme.space.xs },
  // The same box as TextField's plain look, so a dropdown and a text field sit in one form.
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.s,
    minHeight: theme.size.touch + 4,
    paddingLeft: theme.space.l,
    paddingRight: theme.space.m,
    borderRadius: theme.radius.tile,
    borderWidth: 1.5,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
  },
  boxPressed: { opacity: 0.7 },
  value: { ...theme.type.body, flex: 1, minWidth: 0, color: theme.color.textPrimary },
  placeholder: { color: theme.color.textTertiary },
  list: { gap: theme.space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.m,
    minHeight: theme.size.touch + 4,
    paddingHorizontal: theme.space.l,
    borderRadius: theme.radius.tile,
  },
  rowSelected: { backgroundColor: theme.color.primarySoft },
  rowText: { ...theme.type.body, flex: 1, color: theme.color.textPrimary },
  rowTextSelected: { color: theme.color.primary, fontFamily: theme.font.semiBold },
});
