import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { AttemptView } from '../../../api/schema';
import { ReferralRepository } from '../../../api/referral.repository';
import { useLiveReferral, type Run } from '../../../api/useLiveReferral';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ErrorState from '../../../components/ui/ErrorState';
import Screen from '../../../components/ui/Screen';
import SearchField from '../../../components/ui/SearchField';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import SectionHeader from '../../../components/ui/SectionHeader';
import StatusPill from '../../../components/ui/StatusPill';
import { GROUP_TITLE, cardsOf, groupCards, holdState, isCancellable, nextReferralId, searchTimes } from '../../../lib/board';
import { REFERRAL_STATUS, mmss, shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { matches } from '../../../lib/search';
import { useSearch } from '../../../lib/useSearch';
import type { RootScreenProps } from '../../../navigation/types';
import theme from '../../../theme';
import AlertCard from '../components/AlertCard';
import AttemptCard from '../components/AttemptCard';
import CancelSheet from '../components/CancelSheet';
import ExhaustedPanel from '../components/ExhaustedPanel';
import StabilisePanel from '../components/StabilisePanel';
import HoldPanel from '../components/HoldPanel';
import Metric from '../components/Metric';
import SelectSheet from '../components/SelectSheet';
import Timeline from '../components/Timeline';

/** The live board for one referral: timers, a card per hospital, the hold panel and the activity feed. */
export default function ReferralBoard({ route, navigation }: RootScreenProps<'ReferralBoard'>) {
  const { id } = route.params;
  const { view, nowMs, act, actionError, loadError, stale, refresh } = useLiveReferral(id);
  const [selecting, setSelecting] = useState<AttemptView | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { searching, query, setQuery, toggle: toggleSearch } = useSearch();

  // Child components only need to know whether an action worked.
  const run: Run = useCallback(async (call) => (await act(call)).ok, [act]);
  const cards = useMemo(() => (view ? cardsOf(view.attempts) : []), [view]);
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'ReferralsTab' }));

  if (!view) {
    return (
      <Screen testID="board" header={<ScreenHeader title={t('Referral')} onBack={back} />}>
        {loadError ? (
          <ErrorState message={loadError} onRetry={() => void refresh()} what={t('the referral')} />
        ) : (
          <ActivityIndicator color={theme.color.primary} accessibilityLabel={t('Loading')} />
        )}
      </Screen>
    );
  }

  const r = view.referral;
  const status = REFERRAL_STATUS[r.status] ?? { text: r.status, tone: 'grey' as const };
  const { elapsed, ttfa } = searchTimes(r, view.events, nowMs);
  const { hold, releases, expired } = holdState(view);
  const nextId = nextReferralId(view.events);
  const facilityName = (facilityId: unknown) => shortName(view.attempts.find((a) => a.facility_id === facilityId)?.facility_name);
  const alerts = view.alerts.filter((al) => !['cancelled', 'closed'].includes(r.status) || al.type === 'alert');
  const showHold = r.status === 'confirming' || r.status === 'confirmed' || (r.status === 'cancelled' && releases.length > 0);
  const needs = view.needs.map((n) => n.label).join(', ') || '–';

  return (
    <Screen
      testID="board"
      refreshing={false}
      onRefresh={() => void refresh()}
      header={
        <ScreenHeader
          title={t('Referral {code}', { code: r.code })}
          subtitle={view.referrer.name.replace(' (Demo)', '')}
          onBack={back}
          onSearch={toggleSearch}
          searching={searching}
        />
      }
    >
      {searching ? (
        <SearchField value={query} onChangeText={setQuery} placeholder={t('Search the hospitals in this referral')} testID="board-search" />
      ) : null}
      <Card style={styles.summary}>
        <View style={styles.caseBlock}>
          <Text style={styles.case} testID="case-label">
            {view.case_label}
          </Text>
          <Text style={styles.sub}>
            <Text style={[styles.acuity, { color: theme.acuity[r.acuity] }]}>{t(r.acuity)}</Text>
            {` · ${t('needs {needs}', { needs })}`}
          </Text>
        </View>
        <View style={styles.metrics}>
          <Metric label={t('Elapsed')} value={mmss(elapsed)} />
          <Metric label={t('First yes')} value={ttfa !== null ? mmss(ttfa) : '–'} strong={ttfa !== null} />
          <View style={styles.statusSlot}>
            <StatusPill tone={status.tone} label={t(status.text)} />
          </View>
        </View>
        {isCancellable(r.status) ? (
          <Button size="medium" variant="text" label={t('Cancel referral')} onPress={() => setCancelling(true)} testID="cancel-referral" />
        ) : null}
      </Card>

      {stale ? (
        <Banner
          tone="warning"
          title={t('Reconnecting')}
          body={t('No signal. Showing the last update; it refreshes when you are back online.')}
        />
      ) : null}
      {actionError ? <Banner tone="alert" title={actionError} /> : null}
      {alerts.map((al) => (
        <AlertCard
          key={al.event_id}
          alert={al}
          onDismiss={() => void run(() => ReferralRepository.dismissAlert(r.id, al.event_id))}
        />
      ))}
      {showHold ? (
        <HoldPanel view={view} hold={hold} releases={releases} holdExpired={expired} facilityName={facilityName} nowMs={nowMs} act={run} />
      ) : null}
      {(r.status === 'searching' || r.status === 'options_ready') && view.nearest_ed.length > 0 ? <StabilisePanel hospitals={view.nearest_ed} /> : null}
      {r.status === 'exhausted' ? (
        <ExhaustedPanel
          view={view}
          cards={cards.map((c) => c.a)}
          nowMs={nowMs}
          onWiden={async () => {
            const res = await act(() => ReferralRepository.widen(r.id, 80));
            if (res.ok) navigation.replace('ReferralBoard', { id: res.data.id });
          }}
        />
      ) : null}
      {nextId ? (
        <View style={styles.next}>
          <Banner tone="info" title={t('The search continues in a new referral with a wider radius.')} />
          <Button label={t('Open the new referral')} onPress={() => navigation.replace('ReferralBoard', { id: nextId })} />
        </View>
      ) : null}

      {groupCards(
        cards.filter(({ a }) => matches(query, shortName(a.facility_name))),
        nowMs,
      ).map(({ g, items }) => (
        <View key={g} style={styles.group}>
          <SectionHeader title={t(GROUP_TITLE[g])} subtitle={String(items.length)} />
          {items.map(({ a, calls }) => (
            <AttemptCard
              key={a.id}
              attempt={a}
              calls={calls}
              nowMs={nowMs}
              referralStatus={r.status}
              isSelected={r.selected_attempt_id === a.id}
              portalFlag={view.portal_flags[a.id] ?? null}
              origin={view.origin}
              onSelect={() => setSelecting(a)}
              act={run}
            />
          ))}
        </View>
      ))}

      <Timeline view={view} facilityName={facilityName} />

      {selecting ? (
        <SelectSheet
          attempt={selecting}
          onClose={() => setSelecting(null)}
          onConfirmCall={async () =>
            void (await run(() => ReferralRepository.select(r.id, selecting.id, selecting.needs_review)))
          }
          onConfirmManual={async (contact) =>
            void (await run(() => ReferralRepository.confirmManually(r.id, selecting.id, contact || null)))
          }
        />
      ) : null}
      {cancelling ? (
        <CancelSheet
          onClose={() => setCancelling(false)}
          onCancel={async (reason) => void (await run(() => ReferralRepository.cancel(r.id, reason)))}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: theme.space.m },
  caseBlock: { gap: theme.space.xs },
  case: { ...theme.type.heading, color: theme.color.textPrimary },
  sub: { ...theme.type.caption, color: theme.tint.muted },
  acuity: { ...theme.type.captionStrong, textTransform: 'capitalize' },
  metrics: { flexDirection: 'row', gap: theme.space.xl },
  statusSlot: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  next: { gap: theme.space.s },
  group: { gap: theme.space.m },
});
