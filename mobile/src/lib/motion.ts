import { AccessibilityInfo, LayoutAnimation } from 'react-native';
import theme from '../theme';

let reduced = false;

// The phone's Reduce Motion setting is read once and then followed.
AccessibilityInfo.isReduceMotionEnabled().then(
  (value) => (reduced = value),
  () => undefined,
);
AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => (reduced = value));

/**
 * Makes the next change of layout (a section opening, a row appearing, a search box sliding in) ease into place over a short
 * moment instead of jumping. Call it just before the state change; it does nothing when the phone asks for less motion.
 */
export function animateLayout(): void {
  if (reduced) return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(theme.motion.base, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
  );
}
