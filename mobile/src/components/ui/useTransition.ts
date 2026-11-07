import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import theme from '../../theme';
import useReducedMotion from './useReducedMotion';

/**
 * A value that eases between 0 (off) and 1 (on) whenever `on` changes, for colours that follow a choice: the fill of a chosen chip,
 * the thumb of a switch. It jumps at once when the phone asks for less motion. Colours cannot use the native driver, so this one is
 * driven from the JS thread.
 */
export default function useTransition(on: boolean): Animated.Value {
  const progress = useRef(new Animated.Value(on ? 1 : 0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    const toValue = on ? 1 : 0;
    if (reduced !== false) {
      progress.setValue(toValue);
      return;
    }
    Animated.timing(progress, { toValue, duration: theme.motion.base, easing: theme.easing.out, useNativeDriver: false }).start();
  }, [on, reduced, progress]);

  return progress;
}
