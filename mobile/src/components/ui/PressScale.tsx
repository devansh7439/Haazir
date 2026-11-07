import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import theme from '../../theme';
import useReducedMotion from './useReducedMotion';

// Enough to feel the press under a thumb without the control looking as if it jumped.
const PRESSED_SCALE = 0.97;

export type PressScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /**
   * A fill that changes colour with a choice (a chip turning dark). It is drawn on its own layer behind the content: a colour has to
   * be animated from the JS thread and the press from the native one, and one view cannot be driven both ways.
   */
  fill?: Animated.WithAnimatedValue<ViewStyle>;
  /** How far it shrinks while held, from 1 (not at all) down. */
  pressedScale?: number;
  children: ReactNode;
};

/** A pressable that eases down a little under the finger and back up when it lets go; it stays still when the phone asks for less motion. */
export default function PressScale({
  style,
  fill,
  pressedScale = PRESSED_SCALE,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  const ease = (toValue: number, duration: number) => {
    if (reduced !== false) return;
    Animated.timing(scale, { toValue, duration, easing: theme.easing.out, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        ease(pressedScale, theme.motion.fast);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        ease(1, theme.motion.base);
        onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {fill ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fillLayer, fill]} /> : null}
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Behind the content: on the web an absolutely placed layer would otherwise paint over an svg icon drawn after it.
  fillLayer: { zIndex: -1 },
});
