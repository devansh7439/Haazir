import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Banner from '../../../components/ui/Banner';
import BrandMark from '../../../components/ui/BrandMark';
import Illustration from '../../../components/ui/Illustration';
import Button from '../../../components/ui/Button';
import Screen from '../../../components/ui/Screen';
import TextField from '../../../components/ui/TextField';
import { t } from '../../../lib/i18n';
import { useSession } from '../../../lib/session/SessionProvider';
import theme from '../../../theme';
import LanguageSwitch from '../../account/components/LanguageSwitch';

/** Sign in: the server address first (it changes with every tunnel), then the passcode or the email and password. */
export default function SignIn() {
  const { state, authMode, signIn } = useSession();
  const insets = useSafeAreaInsets();
  const saved = state.status === 'signedOut' ? state.serverUrl : '';
  const [server, setServer] = useState(saved);
  const [mode, setMode] = useState<'passcode' | 'users' | null>(null);
  const [passcode, setPasscode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong'));
    } finally {
      setBusy(false);
    }
  };
  const connect = () => run(async () => setMode(await authMode(server)));
  const submit = () => run(() => signIn(server, mode === 'passcode' ? { passcode } : { email, password }));
  const ready = mode === 'passcode' ? passcode.trim().length > 0 : email.trim().length > 0 && password.length > 0;

  return (
    <Screen
      testID="sign-in"
      header={
        <View style={[styles.brand, { paddingTop: insets.top + theme.space.xxl }]}>
          <Illustration name="calls" width={250} />
          <BrandMark size={48} />
          <Text style={styles.name}>{t('Haazir')}</Text>
          <Text style={styles.lead}>
            {t('Find a hospital bed for an emergency referral. Haazir phones every capable hospital at once.')}
          </Text>
        </View>
      }
    >
      <TextField
        appearance="plain"
        label={t('Server')}
        value={server}
        onChangeText={(text) => {
          setServer(text);
          setMode(null);
        }}
        placeholder="your-tunnel.ngrok.app"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        helper={t('The address of your Haazir server.')}
        testID="server"
      />
      {mode === 'passcode' ? (
        <TextField
          appearance="plain"
          label={t('Passcode')}
          value={passcode}
          onChangeText={setPasscode}
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={submit}
          testID="passcode"
        />
      ) : null}
      {mode === 'users' ? (
        <>
          <TextField
            appearance="plain"
            label={t('Email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            testID="email"
          />
          <TextField
            appearance="plain"
            label={t('Password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            onSubmitEditing={submit}
            testID="password"
          />
        </>
      ) : null}
      {error ? <Banner tone="alert" title={error} /> : null}
      {mode === null ? (
        <Button label={t('Continue')} loading={busy} disabled={!server.trim()} onPress={connect} testID="continue" />
      ) : (
        <Button label={t('Sign in')} loading={busy} disabled={!ready} onPress={submit} testID="sign-in-submit" />
      )}
      <View style={styles.language}>
        <Text style={styles.languageLabel}>{t('Language')}</Text>
        <LanguageSwitch />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { gap: theme.space.m, paddingHorizontal: theme.size.screenPadding, paddingBottom: theme.space.xl },
  name: { ...theme.type.display, color: theme.tint.ink },
  lead: { ...theme.type.body, color: theme.tint.muted },
  language: { gap: theme.space.s, marginTop: theme.space.s },
  languageLabel: { ...theme.type.caption, color: theme.tint.muted },
});
