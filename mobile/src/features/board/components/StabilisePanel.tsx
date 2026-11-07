import { StyleSheet, Text } from 'react-native';
import type { ReferralView } from '../../../api/schema';
import Card from '../../../components/ui/Card';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';
import NearestEdList from './NearestEdList';

/** For a critical patient while the search runs: stabilising at the nearest emergency department is the doctor's call. */
export default function StabilisePanel({ hospitals }: { hospitals: ReferralView['nearest_ed'] }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('Can’t wait for a yes?')}</Text>
      <Text style={styles.meta}>
        {t('A critical patient may do better stabilised at the nearest emergency department, then transferred. The search keeps running either way.')}
      </Text>
      <NearestEdList hospitals={hospitals} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space.l },
  title: { ...theme.type.bodyStrong, color: theme.color.textPrimary },
  meta: { ...theme.type.caption, color: theme.tint.muted },
});
