import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReferralListItem } from '../../../api/schema';
import Glass from '../../../components/ui/Glass';
import Icon from '../../../components/ui/Icon';
import { REFERRAL_STATUS, mmss } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** A strip above the tab bar while a referral is in progress, so its board is one tap away from every page; it floats as glass above the tab bar. */
export default function LiveReferralBar({ referral: r, onOpen }: { referral: ReferralListItem; onOpen: () => void }) {
  const status = REFERRAL_STATUS[r.status] ?? { text: r.status, tone: 'grey' as const };
  const line = r.ttfa_seconds !== null ? t('first yes in {time}', { time: mmss(r.ttfa_seconds) }) : t(status.text);
  return (
    <Glass radius={theme.radius.card} interactive style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Open referral {code}: {status}', { code: r.code, status: line })}
        onPress={onOpen}
        style={({ pressed }) => [styles.press, pressed && styles.pressed]}
      >
        <View style={styles.dot} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {r.case_label}
          </Text>
          <Text style={styles.line} numberOfLines={1}>
            {`${r.code} · ${line}`}
          </Text>
        </View>
        <Icon name="chevron-up" size={theme.size.icon} color={theme.color.primary} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  bar: { marginHorizontal: theme.space.l, marginBottom: theme.space.s },
  press: { flexDirection: 'row', alignItems: 'center', gap: theme.space.m, paddingHorizontal: theme.space.l, paddingVertical: theme.space.m },
  pressed: { opacity: 0.85 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.tone.green.accent },
  text: { flex: 1 },
  title: { ...theme.type.captionStrong, color: theme.color.textPrimary },
  line: { ...theme.type.caption, color: theme.color.textSecondary },
});
