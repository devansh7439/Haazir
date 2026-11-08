import { StyleSheet, Text, View } from 'react-native';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Screen from '../../../components/ui/Screen';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import SwitchRow, { NavRow } from '../../../components/ui/SwitchRow';
import { shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { registerPush, usePushStatus } from '../../../lib/push/push';
import { useSignedIn } from '../../../lib/session/SessionProvider';
import { updateSettings, useSettings } from '../../../lib/settings';
import theme from '../../../theme';
import LanguageSwitch from '../components/LanguageSwitch';

const Line = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.line, !last && styles.divider]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value} selectable>
      {value}
    </Text>
  </View>
);

/** Who is signed in, and the few things that are set once: language, alerts and what each page shows. */
export default function Account() {
  const { boot, serverUrl, signOut } = useSignedIn();
  const push = usePushStatus();
  const settings = useSettings();
  const referrer = boot.referrer;

  return (
    <Screen testID="account" inTabs header={<ScreenHeader title={t('Your account')} />}>
      <Card>
        <Line label={t('Name')} value={shortName(boot.user.name ?? referrer?.name ?? t('Shared passcode'))} />
        {boot.user.email ? <Line label={t('Email')} value={boot.user.email} /> : null}
        <Line
          label={t('Refers as')}
          value={
            referrer
              ? `${shortName(referrer.name)}${referrer.facility ? ` · ${shortName(referrer.facility)}` : ''}`
              : t('No referring doctor set up')
          }
        />
        <Line label={t('Server')} value={serverUrl} last />
      </Card>

      {!boot.bolna_ready ? (
        <Banner
          tone="warning"
          title={t('Calls are off')}
          body={t('The server has no Bolna setup yet, so Find a bed can’t phone hospitals.')}
        />
      ) : null}

      <Card padded={false}>
        <View style={styles.row}>
          <View style={styles.setting}>
            <Text style={styles.settingTitle}>{t('Language')}</Text>
            <LanguageSwitch />
          </View>
        </View>
        <View style={[styles.row, styles.dividerTop]}>
          <NavRow
            title={t('Notifications')}
            subtitle={
              push === 'on'
                ? t('You hear about a first yes, a desk asking for you, and a held bed.')
                : t('Tap to turn on alerts for your referrals.')
            }
            value={push === 'on' ? t('On') : t('Off')}
            onPress={() => void registerPush()}
          />
        </View>
        <View style={[styles.row, styles.dividerTop]}>
          <SwitchRow
            title={t('Start from my location')}
            subtitle={t('Use this phone’s position for each search, without asking.')}
            value={settings.useLocation}
            onValueChange={(on) => updateSettings({ useLocation: on })}
          />
        </View>
        <View style={[styles.row, styles.dividerTop]}>
          <SwitchRow
            title={t('Show activity on a referral')}
            subtitle={t('Open the list of what happened, call by call, instead of hiding it.')}
            value={settings.showActivity}
            onValueChange={(on) => updateSettings({ showActivity: on })}
          />
        </View>
        <View style={[styles.row, styles.dividerTop]}>
          <SwitchRow
            title={t('Show Google ratings')}
            subtitle={t('Stars and review counts on each hospital, when the server has them.')}
            value={settings.showRatings}
            onValueChange={(on) => updateSettings({ showRatings: on })}
          />
        </View>
      </Card>

      <Button label={t('Sign out')} icon="sign-out" variant="danger" onPress={signOut} testID="sign-out" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { gap: 2, paddingVertical: theme.space.m },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.tint.hairline },
  dividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.tint.hairline },
  label: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  value: { ...theme.type.body, color: theme.color.textPrimary },
  row: { paddingHorizontal: theme.space.l },
  setting: { gap: theme.space.xs, paddingVertical: theme.space.m },
  settingTitle: { ...theme.type.secondary, color: theme.color.textPrimary },
});
