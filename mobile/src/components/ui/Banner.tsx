import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import Icon, { type IconName } from './Icon';

export type BannerTone = 'info' | 'warning' | 'alert' | 'success';

const TONES: Record<BannerTone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: theme.tint.notice, fg: theme.color.primary, icon: 'info' },
  success: { bg: theme.tint.notice, fg: theme.color.status.verifiedFg, icon: 'check-circle' },
  warning: { bg: theme.color.status.pendingBg, fg: theme.color.status.pendingFg, icon: 'alert' },
  alert: { bg: theme.color.alert.bg, fg: theme.color.alert.fg, icon: 'alert-circle' },
};

export type BannerProps = { tone: BannerTone; title: string; body?: string | undefined; onPress?: () => void; style?: ViewStyle };

/** A notice: a tinted box with an icon, a 3dp rule in the tone's colour, a bold title and an optional line under it. */
export default function Banner({ tone, title, body, onPress, style }: BannerProps) {
  const { bg, fg, icon } = TONES[tone];
  const content = (
    <>
      <View style={styles.icon}>
        <Icon name={icon} size={theme.size.icon} color={fg} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: tone === 'info' ? theme.color.primary : fg }]}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.banner, { backgroundColor: bg, borderLeftColor: fg }, pressed && styles.pressed, style]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View
      accessibilityRole={tone === 'alert' || tone === 'warning' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: bg, borderLeftColor: fg }, style]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.m,
    paddingHorizontal: theme.space.l,
    paddingVertical: theme.space.m + 2,
    borderRadius: theme.radius.field,
    // A 3dp rule in the tone colour tells the kind of notice, with the icon, without leaning on colour alone.
    borderLeftWidth: 3,
  },
  icon: { paddingTop: 2 },
  pressed: { opacity: 0.8 },
  text: { flex: 1 },
  title: { ...theme.type.rowTitle },
  body: { ...theme.type.caption, color: theme.color.textSecondary, marginTop: 2 },
});
