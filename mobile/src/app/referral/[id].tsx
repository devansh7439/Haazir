import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { AttemptView } from "../../api/schema";
import { useLiveReferral } from "../../api/useLiveReferral";
import { GROUP_TITLE, cardsOf, groupCards, holdState, isCancellable, nextReferralId, searchTimes } from "../../lib/board";
import { REFERRAL_STATUS, mmss, shortName } from "../../lib/display";
import { AlertCard } from "../../features/board/AlertCard";
import { AttemptCard } from "../../features/board/AttemptCard";
import { CancelSheet } from "../../features/board/CancelSheet";
import { ExhaustedPanel } from "../../features/board/ExhaustedPanel";
import { HoldPanel } from "../../features/board/HoldPanel";
import { SelectSheet } from "../../features/board/SelectSheet";
import { Timeline } from "../../features/board/Timeline";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Card, SectionTitle } from "../../ui/Card";
import { Pill } from "../../ui/Pill";
import { Screen } from "../../ui/Screen";
import { color, font } from "../../ui/theme";

const ACUITY_COLOR = { critical: "#be123c", serious: "#b45309", stable: "#047857" } as const;

const Metric = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, strong && { color: color.ok }]}>{value}</Text>
  </View>
);

/** The live board for one referral: timers, a card per hospital, the hold panel and the activity feed. */
export default function ReferralBoard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { view, nowMs, act, actionError, loadError, refresh } = useLiveReferral(id);
  const [selecting, setSelecting] = useState<AttemptView | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Child components only need to know whether an action worked.
  const run = useCallback(async (path: string, body?: unknown) => (await act(path, body)).ok, [act]);
  const cards = useMemo(() => (view ? cardsOf(view.attempts) : []), [view]);

  if (!view) {
    return (
      <Screen top={false} testID="board">
        <Stack.Screen options={{ title: "Referral" }} />
        {loadError ? <Callout kind="error">{loadError}</Callout> : <ActivityIndicator color={color.brand} style={{ marginTop: 48 }} />}
      </Screen>
    );
  }

  const r = view.referral;
  const status = REFERRAL_STATUS[r.status] ?? { text: r.status, tone: "grey" as const };
  const { elapsed, ttfa } = searchTimes(r, view.events, nowMs);
  const { hold, releases, expired } = holdState(view);
  const nextId = nextReferralId(view.events);
  const facilityName = (fid: unknown) => shortName(view.attempts.find((a) => a.facility_id === fid)?.facility_name);
  const alerts = view.alerts.filter((al) => !["cancelled", "closed"].includes(r.status) || al.type === "alert");
  const showHold = r.status === "confirming" || r.status === "confirmed" || (r.status === "cancelled" && releases.length > 0);

  return (
    <Screen top={false} refreshing={false} onRefresh={() => void refresh()} testID="board">
      <Stack.Screen options={{ title: r.code }} />
      <Card style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={styles.case} testID="case-label">{view.case_label}</Text>
          <Text style={styles.sub}>
            <Text style={{ color: ACUITY_COLOR[r.acuity], fontWeight: "700", textTransform: "capitalize" }}>{r.acuity}</Text>
            {` · ${view.referrer.name.replace(" (Demo)", "")} · needs ${view.needs.map((n) => n.label).join(", ") || "—"}`}
          </Text>
        </View>
        <View style={styles.metrics}>
          <Metric label="Elapsed" value={mmss(elapsed)} />
          <Metric label="First yes" value={ttfa !== null ? mmss(ttfa) : "—"} strong={ttfa !== null} />
          <View style={{ flex: 1, alignItems: "flex-end", justifyContent: "center" }}>
            <Pill tone={status.tone} text={status.text} />
          </View>
        </View>
        {isCancellable(r.status) && <Button variant="ghost" label="Cancel referral" onPress={() => setCancelling(true)} testID="cancel-referral" />}
      </Card>

      {actionError ? <Callout kind="error">{actionError}</Callout> : null}
      {alerts.map((al) => <AlertCard key={al.event_id} alert={al} onDismiss={() => void run(`/api/referrals/${r.id}/dismiss-alert`, { event_id: al.event_id })} />)}
      {showHold && <HoldPanel view={view} hold={hold} releases={releases} holdExpired={expired} facilityName={facilityName} act={run} />}
      {r.status === "exhausted" && (
        <ExhaustedPanel
          view={view}
          cards={cards.map((c) => c.a)}
          onWiden={async () => {
            const res = await act(`/api/referrals/${r.id}/widen`, { radius_km: 80 });
            const next = res.data && typeof res.data === "object" ? (res.data as { id?: unknown }).id : undefined;
            if (res.ok && typeof next === "string") router.replace(`/referral/${next}`);
          }}
        />
      )}
      {nextId && (
        <Callout kind="info" title="The search continues in a new referral with a wider radius.">
          Open it from the Referrals tab.
        </Callout>
      )}

      {groupCards(cards, nowMs).map(({ g, items }) => (
        <View key={g} style={{ gap: 10 }}>
          <SectionTitle count={items.length}>{GROUP_TITLE[g]}</SectionTitle>
          {items.map(({ a, calls }) => (
            <AttemptCard
              key={a.id}
              a={a}
              calls={calls}
              nowMs={nowMs}
              referralStatus={r.status}
              isSelected={r.selected_attempt_id === a.id}
              portalFlag={view.portal_flags[a.id] ?? null}
              onSelect={() => setSelecting(a)}
              act={run}
            />
          ))}
        </View>
      ))}

      <Timeline view={view} facilityName={facilityName} />

      {selecting && (
        <SelectSheet
          a={selecting}
          onClose={() => setSelecting(null)}
          onConfirmCall={async () => void (await run(`/api/referrals/${r.id}/select`, { attempt_id: selecting.id, force: selecting.needs_review }))}
          onConfirmManual={async (contact) => void (await run(`/api/referrals/${r.id}/confirm-manually`, { attempt_id: selecting.id, contact_person: contact || null }))}
        />
      )}
      {cancelling && <CancelSheet onClose={() => setCancelling(false)} onCancel={async (reason) => void (await run(`/api/referrals/${r.id}/cancel`, { reason }))} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  case: { fontSize: font.xl, fontWeight: "700", color: color.text, letterSpacing: -0.3 },
  sub: { fontSize: font.sm, color: color.muted, lineHeight: 19 },
  metrics: { flexDirection: "row", gap: 24 },
  metric: { gap: 2 },
  metricLabel: { fontSize: font.xs, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  metricValue: { fontSize: 24, fontWeight: "700", color: color.text, fontVariant: ["tabular-nums"] },
});
