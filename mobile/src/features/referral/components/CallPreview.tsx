import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Preview } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import Card from '../../../components/ui/Card';
import { shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** The most hospitals listed before "and more": the list is a glance, not the whole directory. */
const SHOWN = 8;

/**
 * The search result, shown as the form is filled in: the capable hospitals nearest first, each with its distance and
 * travel time, and which of them Haazir phones first. Then what those hospitals will hear.
 */
export default function CallPreview({ preview, loading, error }: { preview: Preview | null; loading: boolean; error: string | null }) {
  if (!preview && !error) {
    return loading ? (
      <ActivityIndicator color={theme.color.primary} accessibilityLabel={t('Loading')} />
    ) : (
      <View style={styles.empty}>
        <Text style={styles.hint}>{t('Choose a case and the nearest capable hospitals appear here.')}</Text>
      </View>
    );
  }
  const eligible = preview?.eligible ?? [];
  const willCall = eligible.filter((e) => e.will_call);
  return (
    <View style={styles.wrap}>
      {error ? <Banner tone="alert" title={error} /> : null}
      {preview ? (
        <View style={styles.list} testID="results">
          <Text style={styles.label}>
            {willCall.length === 1 ? t('1 hospital will be phoned') : t('{count} hospitals will be phoned', { count: willCall.length })}
          </Text>
          {eligible.length > 0 ? (
            <Card style={styles.card}>
              {eligible.slice(0, SHOWN).map((e, index) => (
                <View key={e.facility_id} style={[styles.row, index > 0 && styles.divider]}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={2}>
                      {shortName(e.name)}
                    </Text>
                    <Text style={styles.meta}>
                      {t('{km} km · {eta} min', { km: Math.round(e.distance_km), eta: Math.round(e.eta_minutes) })}
                      {e.will_call ? '' : ` · ${t('Later if needed')}`}
                    </Text>
                  </View>
                </View>
              ))}
              {eligible.length > SHOWN ? <Text style={styles.more}>{t('and {count} more', { count: eligible.length - SHOWN })}</Text> : null}
            </Card>
          ) : (
            <Text style={styles.hint}>{preview.suggestions[0] ?? t('Widen the search distance or change the needs.')}</Text>
          )}
          {preview.skipped_far ? <Text style={styles.hint}>{t('{count} more are too far to call first.', { count: preview.skipped_far })}</Text> : null}
        </View>
      ) : null}
      {preview?.spoken_summary ? (
        <Card tone="muted" style={styles.summary}>
          <Text style={styles.label}>{t('What hospitals will hear')}</Text>
          <Text style={styles.quote} testID="spoken-summary">
            {preview.spoken_summary}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: theme.space.s },
  wrap: { gap: theme.space.l },
  hint: { ...theme.type.caption, color: theme.tint.muted, textAlign: 'center' },
  summary: { gap: theme.space.xs },
  label: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  quote: { ...theme.type.rowTitle, color: theme.color.textPrimary },
  list: { gap: theme.space.s },
  card: { gap: 0, paddingVertical: theme.space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.m, paddingVertical: theme.space.m },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.tint.hairline },
  rank: { ...theme.type.bodyStrong, width: 20, textAlign: 'center', color: theme.color.textTertiary },
  rowText: { flex: 1, gap: 2 },
  name: { ...theme.type.bodyStrong, color: theme.color.textPrimary },
  meta: { ...theme.type.caption, color: theme.tint.muted },
  more: { ...theme.type.caption, color: theme.tint.muted, paddingVertical: theme.space.s, textAlign: 'center' },
});
