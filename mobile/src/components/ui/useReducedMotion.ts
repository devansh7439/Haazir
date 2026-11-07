import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The phone's Reduce Motion setting; null until it is known, so motion waits for the answer instead of starting and stopping. */
export default function useReducedMotion() {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => live && setReduced(value),
      () => live && setReduced(false),
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
