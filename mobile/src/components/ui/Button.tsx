import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import Icon, { type IconName } from './Icon';
import PressScale from './PressScale';
import useTransition from './useTransition';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'text' | 'danger' | 'light';

export type ButtonProps = {
  label: string;
  /** May be async; the button stays as it is, so pass `loading` while the work runs. */
  onPress: () => unknown;
  variant?: ButtonVariant;
  size?: 'large' | 'medium' | 'small';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
};

/** The colour a button's words and icon take: muted when it cannot be pressed, white on the dark fill, the variant's own otherwise. */
const contentColorOf = (variant: ButtonVariant, disabled: boolean): string =>
  disabled
    ? theme.color.textSecondary
    : variant === 'primary'
      ? theme.color.onPrimary
      : variant === 'danger'
        ? theme.color.alert.fg
        : variant === 'secondary'
          ? theme.color.textPrimary
          : theme.color.primary;

/** A button (`secondary` is white on a hairline, `light` the white one for coloured cards). The main one fades from grey to dark as it becomes pressable, and every one sinks a little under the finger. */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'large',
  icon,
  disabled = false,
  loading = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const filled = variant === 'primary';
  const inactive = disabled || loading;
  const ready = useTransition(!disabled);
  const contentColor = contentColorOf(variant, disabled);
  const labelColor = filled
    ? ready.interpolate({ inputRange: [0, 1], outputRange: [theme.color.textSecondary, theme.color.onPrimary] })
    : contentColor;

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      disabled={inactive}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        void onPress();
      }}
      hitSlop={size === 'small' ? { top: 4, bottom: 4 } : undefined}
      style={[
        styles.base,
        variant !== 'text' && styles[size],
        filled && styles.filledBase,
        variant === 'secondary' && styles.secondary,
        variant === 'tonal' && styles.tonal,
        variant === 'light' && styles.light,
        variant === 'danger' && styles.danger,
        disabled && !filled && variant !== 'text' && styles.quietDisabled,
        style,
      ]}
    >
      {filled ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.filledFill, { opacity: ready }]} /> : null}
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={size === 'small' ? theme.size.iconSmall + 1 : theme.size.icon} color={contentColor} /> : null}
          <Animated.Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[size === 'small' ? styles.labelSmall : styles.label, { color: labelColor }]}
          >
            {label}
          </Animated.Text>
        </View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.field, overflow: 'hidden' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.s, flexShrink: 1 },
  large: { minHeight: theme.size.button, paddingHorizontal: theme.space.xl },
  medium: { minHeight: theme.size.touch, paddingHorizontal: theme.space.l },
  small: { minHeight: 40, paddingHorizontal: theme.space.l },
  filledBase: { backgroundColor: theme.color.borderStrong },
  filledFill: { backgroundColor: theme.color.primary },
  secondary: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.borderStrong },
  tonal: { backgroundColor: theme.tint.tile },
  // White on a dark or coloured card, such as the hero on Home.
  light: { backgroundColor: theme.color.surface },
  danger: { backgroundColor: theme.color.alert.bg, borderWidth: 1, borderColor: theme.color.alert.border },
  quietDisabled: { borderColor: theme.color.border },
  label: { ...theme.type.button, flexShrink: 1 },
  labelSmall: { ...theme.type.captionStrong, flexShrink: 1 },
});
