import { type ComponentRef, type ReactNode, forwardRef, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import useReducedMotion from './useReducedMotion';

const RISE_DISTANCE = 12;
const RISE_MS = 360;
const RISE_STAGGER_MS = 60;
const FOCUS_MS = 140;
const BORDER_WIDTH = 2;

type RiseProps = { order?: number; style?: ViewStyle; children: ReactNode };

/** Fades its content in while lifting it a little, each `order` a beat after the one before; shown at once under Reduce Motion. */
export function Rise({ order = 0, style, children }: RiseProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: RISE_MS,
      delay: order * RISE_STAGGER_MS,
      easing: theme.easing.out,
      useNativeDriver: true,
    }).start();
  }, [order, progress, reduced]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [RISE_DISTANCE, 0] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** One short line in the alert colour that fades in where the problem is. */
export function FieldError({ children }: { children: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced === null) return;
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: theme.motion.base, useNativeDriver: true }).start();
  }, [opacity, reduced]);

  return (
    <Animated.View accessibilityLiveRegion="polite" style={{ opacity }}>
      <Text style={styles.error}>{children}</Text>
    </Animated.View>
  );
}

export type FieldCardProps = {
  label?: string | undefined;
  required?: boolean;
  focused?: boolean;
  error?: string | null | undefined;
  disabled?: boolean;
  order?: number | undefined;
  style?: ViewStyle | undefined;
  children: ReactNode;
};

/** The rounded white card every form field sits in: label on top, the control under it, the error line at the foot. */
export function FieldCard({ label, required = false, focused = false, error, disabled = false, order, style, children }: FieldCardProps) {
  const accent = theme.color.primary;
  const focus = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    const toValue = focused ? 1 : 0;
    if (reduced) {
      focus.setValue(toValue);
      return;
    }
    Animated.timing(focus, { toValue, duration: FOCUS_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [focus, focused, reduced]);

  const borderColor = error ? theme.color.alert.fg : focus.interpolate({ inputRange: [0, 1], outputRange: [theme.tint.hairline, accent] });

  return (
    <Rise order={order ?? 0} {...(style ? { style } : {})}>
      <Animated.View style={[styles.card, { borderColor }, disabled && styles.cardDisabled]}>
        {label ? (
          <Text numberOfLines={1} style={styles.label}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
        ) : null}
        {children}
        {error ? <FieldError>{error}</FieldError> : null}
      </Animated.View>
    </Rise>
  );
}

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label?: string;
  /** `plain` is a label over one white rounded box, matching SelectField's plain look for long forms. */
  appearance?: 'card' | 'plain';
  leading?: ReactNode;
  trailing?: ReactNode;
  required?: boolean;
  helper?: string | undefined;
  error?: string | null | undefined;
  showCount?: boolean;
  plainWhenReadOnly?: boolean;
  containerStyle?: ViewStyle;
  order?: number;
};

const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  {
    label,
    appearance = 'card',
    leading,
    trailing,
    required = false,
    helper,
    error,
    showCount = false,
    multiline,
    maxLength,
    value,
    editable = true,
    plainWhenReadOnly = false,
    containerStyle,
    order,
    onFocus,
    onBlur,
    ...inputProps
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const accent = theme.color.primary;
  const plain = appearance === 'plain';

  const input = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label ?? inputProps.placeholder}
        accessibilityHint={error ?? helper}
        placeholderTextColor={theme.color.textTertiary}
        value={value}
        editable={editable}
        multiline={multiline}
        maxLength={maxLength}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          plain && styles.plainInput,
          multiline && styles.inputMultiline,
          !editable && !plainWhenReadOnly && styles.inputDisabled,
        ]}
        {...inputProps}
      />
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (plain) {
    return (
      <Rise order={order ?? 0} {...(containerStyle ? { style: containerStyle } : {})}>
        {label ? (
          <Text numberOfLines={1} style={styles.plainLabel}>
            {label}
            {required ? <Text style={styles.required}> *</Text> : null}
          </Text>
        ) : null}
        <View
          style={[
            styles.plainBox,
            multiline && styles.controlMultiline,
            focused && { borderColor: accent },
            error ? styles.plainBoxError : null,
            !editable && !plainWhenReadOnly && styles.plainBoxDisabled,
          ]}
        >
          {input}
        </View>
        {error ? (
          <View style={styles.plainBelow}>
            <FieldError>{error}</FieldError>
          </View>
        ) : null}
        {showCount && maxLength ? (
          <Text style={[styles.count, styles.plainBelow]}>
            {value?.length ?? 0}/{maxLength}
          </Text>
        ) : null}
        {helper && !error ? <Text style={[styles.helper, styles.plainBelow]}>{helper}</Text> : null}
      </Rise>
    );
  }

  return (
    <FieldCard
      label={label}
      required={required}
      focused={focused}
      error={error}
      disabled={!editable && !plainWhenReadOnly}
      order={order}
      style={containerStyle}
    >
      <View style={[styles.control, multiline && styles.controlMultiline]}>{input}</View>
      {showCount && maxLength ? (
        <Text style={styles.count}>
          {value?.length ?? 0}/{maxLength}
        </Text>
      ) : null}
      {helper && !error ? <Text style={styles.helper}>{helper}</Text> : null}
    </FieldCard>
  );
});

export default TextField;

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.card,
    borderWidth: BORDER_WIDTH,
    backgroundColor: theme.color.surface,
    paddingHorizontal: theme.space.l,
    paddingTop: theme.space.m,
    paddingBottom: theme.space.l,
    gap: theme.space.s,
  },
  cardDisabled: { backgroundColor: theme.color.surfaceMuted },
  label: { ...theme.type.caption, color: theme.tint.muted, flexShrink: 1, minWidth: 0 },
  required: { color: theme.color.required },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.tint.halo,
    paddingLeft: theme.space.l,
    paddingRight: theme.space.s,
  },
  controlMultiline: { alignItems: 'flex-start', minHeight: 120, paddingTop: theme.space.m, paddingBottom: theme.space.m },
  leading: { justifyContent: 'center', paddingRight: theme.space.s },
  input: {
    ...theme.type.rowTitle,
    fontFamily: theme.font.bold,
    flex: 1,
    minWidth: 0,
    color: theme.color.textPrimary,
    paddingVertical: theme.space.s,
    paddingHorizontal: 0,
  },
  inputMultiline: {
    ...theme.type.body,
    textAlignVertical: 'top',
    minHeight: 96,
    paddingTop: 0,
    paddingBottom: 0,
    includeFontPadding: false,
  },
  inputDisabled: { color: theme.color.textSecondary },
  trailing: { marginLeft: theme.space.s, justifyContent: 'center' },
  // The plain look copies SelectField's: the same label, box, border and type, so the two sit side by side as one form.
  plainLabel: { ...theme.type.captionStrong, color: theme.tint.ink, marginBottom: theme.space.xs },
  plainBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingLeft: theme.space.l,
    paddingRight: theme.space.s,
    borderRadius: theme.radius.tile,
    borderWidth: 1.5,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
  },
  plainBoxError: { borderColor: theme.color.alert.fg },
  plainBoxDisabled: { backgroundColor: theme.color.surfaceMuted },
  plainInput: { ...theme.type.body },
  plainBelow: { marginTop: theme.space.xs },
  count: { ...theme.type.caption, color: theme.color.textTertiary, alignSelf: 'flex-end' },
  helper: { ...theme.type.caption, color: theme.tint.muted },
  error: { ...theme.type.caption, color: theme.color.alert.fg },
});
