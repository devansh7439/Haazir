import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import BrandMark from '../../../components/ui/BrandMark';
import Button from '../../../components/ui/Button';
import { t } from '../../../lib/i18n';
import { useSession } from '../../../lib/session/SessionProvider';
import theme from '../../../theme';

/** What shows while the saved session is restored: the mark and a spinner, or, when the server can't be reached, why and what to do. */
export default function LaunchView() {
  const { state, retry, signOut } = useSession();
  return (
    <View style={styles.root}>
      <BrandMark size={72} />
      {state.status === 'unreachable' ? (
        <View style={styles.message}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('Can’t reach Haazir')}
          </Text>
          <Text style={styles.body}>{state.message}</Text>
          <Button label={t('Try again')} onPress={retry} style={styles.action} />
          <Button label={t('Use another server')} variant="text" onPress={signOut} />
        </View>
      ) : (
        <ActivityIndicator color={theme.color.primary} accessibilityLabel={t('Loading')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xl,
    padding: theme.space.xl,
    backgroundColor: theme.color.background,
  },
  message: { alignItems: 'center', gap: theme.space.m, alignSelf: 'stretch' },
  title: { ...theme.type.heading, color: theme.tint.ink, textAlign: 'center' },
  body: { ...theme.type.body, color: theme.tint.muted, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: theme.space.m },
});
