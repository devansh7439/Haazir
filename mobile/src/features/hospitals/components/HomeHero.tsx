import { StyleSheet, Text, View } from 'react-native';
import Button from '../../../components/ui/Button';
import Illustration from '../../../components/ui/Illustration';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/**
 * The top of Home: a crimson card that says what the app is for and starts a referral, with the network's own numbers under
 * it (hospitals, districts, beds offered so far), the way RaktKhoj leads with its donor and blood-bank counts.
 */
export default function HomeHero(props: { hospitals: number | null; districts: number | null; offered: number | null; onFind: () => void }) {
  return (
    <View style={styles.hero}>
      <View style={styles.art}>
        <Illustration name="calls" width={220} tone="light" />
      </View>
      <Text style={styles.title}>{t('Need a bed right now?')}</Text>
      <Text style={styles.body}>{t('Choose a case and Haazir phones every capable hospital at once.')}</Text>
      <Button label={t('Find a bed')} icon="phone-call" variant="light" onPress={props.onFind} testID="start-find-a-bed" />
      <View style={styles.stats}>
        <Stat value={props.hospitals} label={t('Hospitals')} />
        <View style={styles.divider} />
        <Stat value={props.districts} label={t('Districts')} />
        <View style={styles.divider} />
        <Stat value={props.offered} label={t('Beds offered')} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value ?? t('Loading')}`}>
      <Text style={styles.figure}>{value ?? '–'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: theme.tint.hero, borderRadius: theme.radius.card, padding: theme.space.xl, gap: theme.space.m },
  art: { alignItems: 'center' },
  title: { ...theme.type.title, color: theme.color.onPrimary },
  body: { ...theme.type.secondary, color: theme.tint.heroText, marginBottom: theme.space.xs },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: theme.space.s, paddingTop: theme.space.l, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.tint.heroSoft },
  stat: { flex: 1, alignItems: 'center' },
  figure: { ...theme.type.figure, color: theme.color.onPrimary },
  statLabel: { ...theme.type.caption, color: theme.tint.heroText },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: theme.tint.heroSoft },
});
