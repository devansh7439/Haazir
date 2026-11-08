import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ReferralRepository } from '../../../api/referral.repository';
import { useLoad } from '../../../api/useLoad';
import EmptyState from '../../../components/ui/EmptyState';
import ErrorState from '../../../components/ui/ErrorState';
import Screen from '../../../components/ui/Screen';
import SearchField from '../../../components/ui/SearchField';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { t } from '../../../lib/i18n';
import { matches } from '../../../lib/search';
import { animateLayout } from '../../../lib/motion';
import theme from '../../../theme';
import { inProgressFirst, isInProgress } from '../referrals.helper';
import ReferralRow from '../components/ReferralRow';

/** Every referral of the organisation: the ones still in progress first, then the earlier ones. */
export default function Referrals() {
  const navigation = useNavigation();
  const { data, error, loading, refreshing, reload } = useLoad(ReferralRepository.list, []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  // The time the list was loaded: "5 min ago" is relative to this, and it stays steady between renders.
  const nowMs = useMemo(() => Date.now(), [data]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/purity
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const list = (data?.referrals ?? []).filter((r) => matches(query, r.code, r.case_label));
  const shown = inProgressFirst(list);

  return (
    <Screen
      testID="referrals"
      inTabs
      refreshing={refreshing}
      onRefresh={reload}
      header={
        <ScreenHeader
          title={t('Your referrals')}
          subtitle={t('In progress first, then earlier ones.')}
          onSearch={() => {
            animateLayout();
            setSearching((open) => !open);
            setQuery('');
          }}
          searching={searching}
        />
      }
    >
      {searching ? (
        <SearchField value={query} onChangeText={setQuery} placeholder={t('Search referrals by code or case')} testID="referral-search" />
      ) : null}
      {loading && !data ? <ActivityIndicator color={theme.color.primary} accessibilityLabel={t('Loading')} /> : null}
      {error && !data ? <ErrorState message={error} onRetry={reload} what={t('referrals')} /> : null}
      {!loading && !error && shown.length === 0 ? (
        query.trim() ? (
          <EmptyState art="search" title={t('Nothing found for “{query}”', { query: query.trim() })} />
        ) : (
          <EmptyState art="empty" title={t('No referrals yet')} body={t('Start one with Find a bed on the Home tab.')} />
        )
      ) : null}
      {[
        { key: 'active', title: t('In progress'), rows: shown.filter(isInProgress) },
        { key: 'earlier', title: t('Earlier'), rows: shown.filter((r) => !isInProgress(r)) },
      ].map((group) =>
        group.rows.length > 0 ? (
          <View key={group.key} style={styles.list}>
            <Text style={styles.group}>{group.title}</Text>
            {group.rows.map((r) => (
              <ReferralRow key={r.id} referral={r} nowMs={nowMs} onOpen={() => navigation.navigate('ReferralBoard', { id: r.id })} />
            ))}
          </View>
        ) : null,
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.space.m },
  group: { ...theme.type.captionStrong, color: theme.color.textSecondary },
});
