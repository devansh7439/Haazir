import { Linking, StyleSheet, Text, View } from 'react-native';
import type { ReferralView } from '../../../api/schema';
import Button from '../../../components/ui/Button';
import { shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** The closest emergency departments with a direct casualty desk number, nearest first, each with a call button. */
export default function NearestEdList({ hospitals }: { hospitals: ReferralView['nearest_ed'] }) {
  return (
    <>
      {hospitals.map((h) => (
        <View key={h.facility_id} style={styles.item}>
          <Text style={styles.name}>{shortName(h.name)}</Text>
          <Text style={styles.meta}>{t('{km} km · about {minutes} min', { km: h.distance_km, minutes: h.eta_minutes })}</Text>
          <Button size="small" variant="secondary" icon="phone" label={h.phone} onPress={() => void Linking.openURL(`tel:${h.phone}`)} />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  item: { gap: theme.space.s },
  name: { ...theme.type.bodyStrong, color: theme.color.textPrimary },
  meta: { ...theme.type.caption, color: theme.tint.muted },
});
