import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import { t } from '../../lib/i18n';
import type { IconKey, Tone } from '../../lib/display';
import { StatusIcon } from './Icon';

export type StatusPillProps = {
  tone: Tone;
  label: string;
  /** The icon beside the words, so the colour is never the only sign of the status. */
  icon?: IconKey | undefined;
  size?: 'medium' | 'small';
  style?: ViewStyle;
  /** Lines the label may take; a long status on a narrow page wraps instead of being cut. */
  lines?: number;
};

/** A hospital's status or a referral's: a soft pill with an icon and words. */
export default function StatusPill({ tone, label, icon, size = 'medium', style, lines = 2 }: StatusPillProps) {
  const { fg, bg } = theme.tone[tone];
  const small = size === 'small';
  return (
    <View
      accessibilityLabel={t('Status: {label}', { label })}
      style={[styles.pill, small && styles.pillSmall, { backgroundColor: bg }, style]}
    >
      {icon ? <StatusIcon icon={icon} size={small ? 13 : 15} color={fg} /> : null}
      <Text numberOfLines={lines} style={[styles.label, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.m,
    paddingVertical: 5,
  },
  pillSmall: { paddingHorizontal: theme.space.s + 2, paddingVertical: 3 },
  label: { ...theme.type.captionStrong, flexShrink: 1 },
});
