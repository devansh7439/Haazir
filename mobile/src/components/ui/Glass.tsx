import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import theme from '../../theme';

// Liquid Glass is a native iOS 26 material, so it shows only on an iPhone running iOS 26 or later (Expo Go included). Anywhere
// else (Android, the browser preview, older iOS) the same shape is drawn as a nearly opaque white surface with a hairline, which
// keeps text as readable as the glass does.
const NATIVE_GLASS = isLiquidGlassAvailable();

export type GlassProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How round the corners are. Glass is clipped to this, so it is given here and not in `style`. */
  radius?: number;
  /** The glass reacts to touch. Only for a surface that is itself a button. */
  interactive?: boolean;
};

/**
 * A floating panel of Liquid Glass: it blurs and bends what scrolls behind it, so use it only for something that floats over
 * content (the tab bar, the live-referral strip), never for a card in the page. The app is light-only, so the glass is too.
 */
export default function Glass({ children, style, radius = theme.radius.card, interactive = false }: GlassProps) {
  const shape = { borderRadius: radius };
  if (NATIVE_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="light" isInteractive={interactive} style={[shape, styles.clip, style]}>
        {children}
      </GlassView>
    );
  }
  return <View style={[shape, styles.clip, styles.fallback, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  fallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
    ...theme.elevation.raised,
  },
});
