import { type ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import PressScale from './PressScale';

export type CardProps = {
  children: ReactNode;
  onPress?: (() => void) | undefined;
  /** `muted` is the grey card for notes; `held` outlines the card of the hospital the bed is held at. */
  tone?: 'muted' | 'held';
  padded?: boolean;
  /** A colour for the rule down the card's left edge. */
  accent?: string | undefined;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** A white card on a hairline. Given `onPress` it is a button that sinks a little under the finger. */
export default function Card({ children, onPress, tone, padded = true, accent, style, accessibilityLabel }: CardProps) {
  const content = [
    styles.card,
    padded && styles.padded,
    accent ? styles.accented : null,
    tone === 'muted' && styles.muted,
    tone === 'held' && styles.held,
    style,
  ];
  const rule = accent ? <View style={[styles.rule, { backgroundColor: accent }]} /> : null;

  if (!onPress) {
    return (
      <View style={content}>
        {rule}
        {children}
      </View>
    );
  }

  return (
    <PressScale accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} pressedScale={0.985} style={content}>
      {rule}
      {children}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.card, overflow: 'hidden', borderWidth: 1, borderColor: theme.color.border },
  padded: { paddingHorizontal: theme.space.l, paddingVertical: theme.space.m + 2 },
  accented: { paddingLeft: theme.space.l + theme.space.s },
  rule: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  muted: { backgroundColor: theme.tint.tile, borderColor: theme.tint.tile },
  held: { borderWidth: 2, borderColor: theme.color.status.verifiedFg },
});
