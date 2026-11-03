import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../api/client";
import { ReferralListSchema, type ReferralListItem } from "../../api/schema";
import { useLoad } from "../../api/useLoad";
import { REFERRAL_STATUS, mmss } from "../../lib/display";
import { ago } from "../../lib/time";
import { Callout } from "../../ui/Callout";
import { Card } from "../../ui/Card";
import { Pill } from "../../ui/Pill";
import { Screen } from "../../ui/Screen";
import { color, font } from "../../ui/theme";

const ACTIVE = ["searching", "options_ready", "confirming", "confirmed"];

function Row({ r }: { r: ReferralListItem }) {
  const s = REFERRAL_STATUS[r.status] ?? { text: r.status, tone: "grey" as const };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${r.code} ${r.case_label}, ${s.text}`} onPress={() => router.push(`/referral/${r.id}`)}>
      <Card style={styles.row}>
        <View style={styles.rowTop}>
          <Text style={styles.code}>{r.code}</Text>
          <Text style={styles.when}>{ago(r.created_at, Date.now())}</Text>
        </View>
        <Text style={styles.case}>
          {r.case_label}
          <Text style={styles.acuity}>{`  ${r.acuity}`}</Text>
        </Text>
        <View style={styles.rowBottom}>
          <Pill tone={s.tone} text={s.text} small />
          <Text style={styles.yes}>{r.ttfa_seconds !== null ? `first yes in ${mmss(r.ttfa_seconds)}` : `${r.calls_total} calls`}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

/** Every referral of the organisation, newest first, with the ones still in progress on top. */
export default function Referrals() {
  const { data, error, loading, refreshing, reload } = useLoad(() => api("/api/referrals", ReferralListSchema), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const list = data?.referrals ?? [];
  const active = list.filter((r) => ACTIVE.includes(r.status));
  const past = list.filter((r) => !ACTIVE.includes(r.status));
  return (
    <Screen title="Referrals" subtitle="Pull down to refresh." refreshing={refreshing} onRefresh={reload} testID="referrals">
      {error ? <Callout kind="error">{error}</Callout> : null}
      {!loading && !error && list.length === 0 ? <Callout>No referrals yet. Start one from the New referral tab.</Callout> : null}
      {active.length > 0 && <Text style={styles.group}>In progress</Text>}
      {active.map((r) => <Row key={r.id} r={r} />)}
      {past.length > 0 && <Text style={styles.group}>Earlier</Text>}
      {past.map((r) => <Row key={r.id} r={r} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { fontSize: font.sm, fontWeight: "700", color: color.text2, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
  row: { gap: 6 },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  code: { fontSize: font.sm, fontWeight: "700", color: color.muted, fontVariant: ["tabular-nums"] },
  when: { fontSize: font.xs, color: color.faint },
  case: { fontSize: font.lg, fontWeight: "600", color: color.text },
  acuity: { fontSize: font.sm, fontWeight: "500", color: color.muted, textTransform: "capitalize" },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  yes: { fontSize: font.xs, color: color.muted, fontVariant: ["tabular-nums"] },
});
