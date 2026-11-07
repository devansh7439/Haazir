import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import theme from '../../theme';
import Toggle from './Toggle';

type BaseProps = { title: string; subtitle?: string };

export type SwitchRowProps = BaseProps & { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean };

/** A setting with a title, a line of help and a switch on the right; touching the words flips it too. */
export default function SwitchRow({ value, onValueChange, disabled = false, ...base }: SwitchRowProps) {
  return (
    <Pressable
      accessible={false}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <RowShell {...base} disabled={disabled}>
        <Toggle value={value} onValueChange={onValueChange} disabled={disabled} label={base.title} />
      </RowShell>
    </Pressable>
  );
}

/** A setting that opens or does something when touched, with its current value on the right. */
export function NavRow({ value, onPress, ...base }: BaseProps & { value?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${base.title}${value ? `, ${value}` : ''}`} onPress={onPress}>
      {({ pressed }) => (
        <RowShell {...base} pressed={pressed}>
          {value ? (
            <Text numberOfLines={2} style={styles.value}>
              {value}
            </Text>
          ) : null}
        </RowShell>
      )}
    </Pressable>
  );
}

function RowShell({
  title,
  subtitle,
  disabled = false,
  pressed = false,
  children,
}: BaseProps & { disabled?: boolean; pressed?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.row, pressed && styles.pressed]}>
      <View style={styles.text}>
        <Text style={[styles.title, disabled && styles.disabledText]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.l, paddingVertical: theme.space.l },
  pressed: { opacity: 0.7 },
  text: { flex: 1, minWidth: 0 },
  title: { ...theme.type.secondary, color: theme.color.textPrimary },
  disabledText: { color: theme.color.textSecondary },
  subtitle: { ...theme.type.caption, color: theme.color.textSecondary, marginTop: 2 },
  value: { ...theme.type.secondary, color: theme.color.textPrimary, flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
});
