import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FacilityRepository } from '../../../api/facility.repository';
import { useLoad } from '../../../api/useLoad';
import AppBar from '../../../components/ui/AppBar';
import EmptyState from '../../../components/ui/EmptyState';
import ErrorState from '../../../components/ui/ErrorState';
import FilterChip from '../../../components/ui/FilterChip';
import Screen from '../../../components/ui/Screen';
import SearchField from '../../../components/ui/SearchField';
import IconButton from '../../../components/ui/IconButton';
import { shortName } from '../../../lib/display';
import { filterFacilities } from '../../../lib/facility';
import { t } from '../../../lib/i18n';
import { animateLayout } from '../../../lib/motion';
import { useSignedIn } from '../../../lib/session/SessionProvider';
import { useSettings } from '../../../lib/settings';
import theme from '../../../theme';
import HomeHero from '../components/HomeHero';
import HospitalCard from '../components/HospitalCard';
import ServiceFilterSheet from '../components/ServiceFilterSheet';

/** The directory: tap a hospital for its services and desk numbers, to call it or get directions. */
export default function Hospitals() {
  const { boot } = useSignedIn();
  const settings = useSettings();
  const navigation = useNavigation();
  const { data, error, loading, refreshing, reload } = useLoad(FacilityRepository.list, []);
  const [services, setServices] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [filtering, setFiltering] = useState(false);
  // Google ratings load after the list, so a slow Google never delays it.
  const ratings = useLoad(FacilityRepository.ratings, []).data?.ratings ?? {};
  const rows = useMemo(() => filterFacilities(data?.facilities ?? [], query, services), [data, query, services]);
  const stats = useMemo(
    () =>
      data
        ? {
            hospitals: data.facilities.length,
            districts: new Set(data.facilities.map((f) => f.district ?? f.city).filter(Boolean)).size,
            offered: data.facilities.reduce((sum, f) => sum + f.accepted, 0),
          }
        : null,
    [data],
  );
  const toggle = (code: string) => setServices((all) => (all.includes(code) ? all.filter((c) => c !== code) : [...all, code]));

  return (
    <Screen
      testID="hospitals"
      inTabs
      refreshing={refreshing}
      onRefresh={reload}
      header={<AppBar onAccount={() => navigation.navigate('MainTabs', { screen: 'AccountTab' })} />}
    >
      <View style={styles.intro}>
        <View style={styles.introText}>
          <Text accessibilityRole="header" style={styles.greeting}>
            {boot.referrer ? t('Hello, {name}', { name: shortName(boot.referrer.name) }) : t('Home')}
          </Text>
          <Text style={styles.greetingSub}>
            {data ? t('{count} hospitals in your network', { count: data.facilities.length }) : t('Search the hospitals Haazir can phone.')}
          </Text>
        </View>
        <IconButton
          icon={searching ? 'close' : 'search'}
          label={searching ? t('Close search') : t('Search')}
          variant="tinted"
          onPress={() => {
            animateLayout();
            setSearching((open) => !open);
            setQuery('');
          }}
        />
      </View>
      <HomeHero hospitals={stats?.hospitals ?? null} districts={stats?.districts ?? null} offered={stats?.offered ?? null} onFind={() => navigation.navigate('FindBed')} />
      <Text style={styles.heading}>{t('Hospital network')}</Text>
      {searching ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('Search by hospital name, town or district')}
          testID="hospital-search"
        />
      ) : null}
      <View style={styles.filters}>
        <FilterChip
          dropdown
          active={services.length > 0}
          label={services.length ? t('Services ({count})', { count: services.length }) : t('Filter by service')}
          onPress={() => setFiltering(true)}
        />
      </View>
      {loading && !data ? <ActivityIndicator color={theme.color.primary} accessibilityLabel={t('Loading')} /> : null}
      {error && !data ? <ErrorState message={error} onRetry={reload} what={t('hospitals')} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          art={query || services.length ? 'search' : 'empty'}
          title={
            query
              ? t('Nothing found for “{query}”', { query: query.trim() })
              : services.length
                ? t('No hospital offers all of those services.')
                : t('No hospitals listed yet.')
          }
        />
      ) : null}
      {rows.map((f) => (
        <HospitalCard
          key={f.id}
          facility={f}
          rating={settings.showRatings ? ratings[f.id] : undefined}
          onInfo={() => navigation.navigate('HospitalDetail', { id: f.id })}
        />
      ))}
      <ServiceFilterSheet
        visible={filtering}
        onClose={() => setFiltering(false)}
        capabilities={boot.capabilities}
        selected={services}
        onToggle={toggle}
        onClear={() => setServices([])}
        matching={rows.length}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: theme.space.m },
  introText: { flex: 1 },
  greeting: { ...theme.type.pageTitle, color: theme.tint.heading },
  greetingSub: { ...theme.type.secondary, color: theme.tint.muted, marginTop: theme.space.xs },
  heading: { ...theme.type.rowTitle, color: theme.tint.heading },
  filters: { flexDirection: 'row', gap: theme.space.s },
});
