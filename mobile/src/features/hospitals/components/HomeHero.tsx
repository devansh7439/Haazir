import { StyleSheet, Text, View } from 'react-native';
import Button from '../../../components/ui/Button';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** The top of Home: a crimson card that says what the app is for and starts a referral. */
export default function HomeHero({ onFind }: { onFind: () => void }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.title}>{t('Need a bed right now?')}</Text>
      <Text style={styles.body}>{t('Choose a case and Haazir phones every capable hospital at once.')}</Text>
      <Button label={t('Find a bed')} icon="phone-call" variant="light" onPress={onFind} testID="start-find-a-bed" />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: theme.tint.hero, borderRadius: theme.radius.card, padding: theme.space.xl, gap: theme.space.m },
  title: { ...theme.type.title, color: theme.color.onPrimary },
  body: { ...theme.type.secondary, color: theme.tint.heroText, marginBottom: theme.space.xs },
});
