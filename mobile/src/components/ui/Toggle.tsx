import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import theme from '../../theme';
import useReducedMotion from './useReducedMotion';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB = 26;
const INSET = (TRACK_HEIGHT - THUMB) / 2;
const TRAVEL = TRACK_WIDTH - THUMB - INSET * 2;

export type ToggleProps = { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; label: string };

/** An on and off switch: the dark fill fades in under the thumb as it glides across, with a light tap under the finger. */
export default function Toggle({ value, onValueChange, disabled = false, label }: ToggleProps) {
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    const toValue = value ? 1 : 0;
    if (reduced !== false) {
      position.setValue(toValue);
      return;
    }
    Animated.timing(position, { toValue, duration: theme.motion.base, easing: theme.easing.slide, useNativeDriver: true }).start();
  }, [value, reduced, position]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onValueChange(!value);
      }}
      style={[styles.track, disabled && styles.disabled]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { opacity: position }]} />
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }] }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: INSET,
    justifyContent: 'center',
    backgroundColor: theme.color.borderStrong,
    overflow: 'hidden',
  },
  fill: { backgroundColor: theme.color.primary },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: theme.color.surface, ...theme.elevation.card },
  disabled: { opacity: 0.5 },
});
