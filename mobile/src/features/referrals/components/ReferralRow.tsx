import { StyleSheet, Text, View } from 'react-native';
import type { ReferralListItem } from '../../../api/schema';
import Card from '../../../components/ui/Card';
import StatusPill from '../../../components/ui/StatusPill';
import { REFERRAL_STATUS, mmss } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { ago } from '../../../lib/time';
import theme from '../../../theme';

/** One referral in the list: its code and age, the case, its status, and how fast the first hospital said yes. */
export default function ReferralRow({ referral: r, nowMs, onOpen }: { referral: ReferralListItem; nowMs: number; onOpen: () => void }) {
  const status = REFERRAL_STATUS[r.status] ?? { text: r.status, tone: 'grey' as const };
  const statusText = t(status.text);
  return (
    <Card onPress={onOpen} accessibilityLabel={`${r.code} ${r.case_label}, ${statusText}`} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.code}>{r.code}</Text>
        <Text style={styles.when}>{ago(r.created_at, nowMs)}</Text>
      </View>
      <Text style={styles.case}>
        {r.case_label}
        <Text style={styles.acuity}>{`  ${t(r.acuity)}`}</Text>
      </Text>
      <View style={styles.bottom}>
        <StatusPill tone={status.tone} label={statusText} size="small" />
        <Text style={styles.yes}>
          {r.ttfa_seconds !== null
            ? t('first yes in {time}', { time: mmss(r.ttfa_seconds) })
            : t('{count} calls', { count: r.calls_total })}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space.s },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  code: { ...theme.type.captionStrong, color: theme.tint.muted, fontVariant: ['tabular-nums'] },
  when: { ...theme.type.caption, color: theme.color.textTertiary },
  case: { ...theme.type.rowTitle, color: theme.color.textPrimary },
  acuity: { ...theme.type.caption, color: theme.tint.muted, textTransform: 'capitalize' },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.s },
  yes: { ...theme.type.caption, color: theme.tint.muted, fontVariant: ['tabular-nums'] },
});
