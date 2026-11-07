import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import FilterChip from '../../../components/ui/FilterChip';
import Screen from '../../../components/ui/Screen';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import SearchField from '../../../components/ui/SearchField';
import SwitchRow, { NavRow } from '../../../components/ui/SwitchRow';
import { shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { matches } from '../../../lib/search';
import { animateLayout } from '../../../lib/motion';
import { registerPush, usePushStatus } from '../../../lib/push/push';
import { useSignedIn } from '../../../lib/session/SessionProvider';
import { updateSettings, useSettings } from '../../../lib/settings';
import theme from '../../../theme';
import { RADII_KM } from '../../referral/referralOptions';
import LanguageSwitch from '../components/LanguageSwitch';

type Group = 'find' | 'referrals' | 'hospitals' | 'app';

/** One thing a person can change: the page it belongs to, the words a search matches, and the control. */
interface Row {
  key: string;
  group: Group;
  words: string;
  node: ReactNode;
}

const GROUPS: Array<{ id: Group; title: () => string }> = [
  { id: 'find', title: () => t('Find a bed') },
  { id: 'referrals', title: () => t('Your referrals') },
  { id: 'hospitals', title: () => t('Hospital network') },
  { id: 'app', title: () => t('Whole app') },
];

const Line = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.line, !last && styles.divider]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value} selectable>
      {value}
    </Text>
  </View>
);

/** Who is signed in, and a place to change how each page of the app behaves. */
export default function Account() {
  const { boot, serverUrl, signOut } = useSignedIn();
  const push = usePushStatus();
  const settings = useSettings();
  const referrer = boot.referrer;
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const rows: Row[] = [
    {
      key: 'radius',
      group: 'find',
      words: 'search distance radius km far',
      node: (
        <View style={styles.setting}>
          <Text style={styles.settingTitle}>{t('Search distance')}</Text>
          <Text style={styles.settingHint}>{t('How far a new search reaches to start with.')}</Text>
          <View style={styles.chips}>
            {RADII_KM.map((km) => (
              <FilterChip
                key={km}
                label={t('{km} km', { km })}
                selected={km === settings.radiusKm}
                onPress={() => updateSettings({ radiusKm: km })}
              />
            ))}
          </View>
        </View>
      ),
    },
    {
      key: 'location',
      group: 'find',
      words: 'start from my location position gps',
      node: (
        <SwitchRow
          title={t('Start from my location')}
          subtitle={t('Use this phone’s position for each search, without asking.')}
          value={settings.useLocation}
          onValueChange={(on) => updateSettings({ useLocation: on })}
        />
      ),
    },
    {
      key: 'notifications',
      group: 'referrals',
      words: 'notifications alerts push first yes desk bed held',
      node: (
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
      ),
    },
    {
      key: 'activity',
      group: 'referrals',
      words: 'activity feed timeline events log',
      node: (
        <SwitchRow
          title={t('Show activity on a referral')}
          subtitle={t('Open the list of what happened, call by call, instead of hiding it.')}
          value={settings.showActivity}
          onValueChange={(on) => updateSettings({ showActivity: on })}
        />
      ),
    },
    {
      key: 'ratings',
      group: 'hospitals',
      words: 'google ratings stars reviews',
      node: (
        <SwitchRow
          title={t('Show Google ratings')}
          subtitle={t('Stars and review counts on each hospital, when the server has them.')}
          value={settings.showRatings}
          onValueChange={(on) => updateSettings({ showRatings: on })}
        />
      ),
    },
    {
      key: 'language',
      group: 'app',
      words: 'language hindi english',
      node: (
        <View style={styles.setting}>
          <Text style={styles.settingTitle}>{t('Language')}</Text>
          <LanguageSwitch />
        </View>
      ),
    },
  ];
  const shown = (group: Group) =>
    rows.filter((row) => row.group === group && matches(query, row.words, GROUPS.find((g) => g.id === group)?.title()));
  const nothing = query.trim().length > 0 && GROUPS.every((g) => shown(g.id).length === 0);

  return (
    <Screen
      testID="account"
      inTabs
      header={
        <ScreenHeader
          title={t('Your account')}
          subtitle={t('Who you are, and how each page works for you.')}
          onSearch={() => {
            animateLayout();
            setSearching((open) => !open);
            setQuery('');
          }}
          searching={searching}
        />
      }
    >
      {searching ? <SearchField value={query} onChangeText={setQuery} placeholder={t('Search settings')} testID="settings-search" /> : null}

      {!query.trim() ? (
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
      ) : null}

      {!query.trim() && !boot.bolna_ready ? (
        <Banner
          tone="warning"
          title={t('Calls are off')}
          body={t('The server has no Bolna setup yet, so Find a bed can’t phone hospitals.')}
        />
      ) : null}

      {!nothing ? (
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.headingText}>
            {t('Change settings')}
          </Text>
          <Text style={styles.headingHint}>{t('Grouped by the page they change.')}</Text>
        </View>
      ) : null}

      {GROUPS.map((group) => {
        const list = shown(group.id);
        if (list.length === 0) return null;
        return (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title()}</Text>
            <Card padded={false}>
              {list.map((row, index) => (
                <View key={row.key} style={[styles.row, index > 0 && styles.dividerTop]}>
                  {row.node}
                </View>
              ))}
            </Card>
          </View>
        );
      })}

      {nothing ? <EmptyState art="search" title={t('Nothing found for “{query}”', { query: query.trim() })} /> : null}

      {!query.trim() ? <Button label={t('Sign out')} icon="sign-out" variant="danger" onPress={signOut} testID="sign-out" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { gap: 2, paddingVertical: theme.space.m },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.tint.hairline },
  dividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.tint.hairline },
  label: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  value: { ...theme.type.body, color: theme.color.textPrimary },
  heading: { marginTop: theme.space.s },
  headingText: { ...theme.type.title, color: theme.tint.ink },
  headingHint: { ...theme.type.caption, color: theme.tint.muted, marginTop: 2 },
  group: { gap: theme.space.s },
  groupTitle: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  row: { paddingHorizontal: theme.space.l },
  setting: { gap: theme.space.xs, paddingVertical: theme.space.m },
  settingTitle: { ...theme.type.secondary, color: theme.color.textPrimary },
  settingHint: { ...theme.type.caption, color: theme.color.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s, marginTop: theme.space.s },
});
