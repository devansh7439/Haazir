import { Linking, StyleSheet, Text, View } from "react-native";
import type { AttemptView, ReferralView } from "../../api/schema";
import { attemptDisplay, shortName } from "../../lib/display";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Card } from "../../ui/Card";
import { color, font } from "../../ui/theme";

/** Nobody accepted: the doctor can phone each desk directly, or widen the search to 80 km. */
export function ExhaustedPanel({ view, cards, onWiden }: { view: ReferralView; cards: AttemptView[]; onWiden: () => Promise<void> }) {
  const calls = view.attempts.filter((a) => a.purpose === "availability").length;
  const rounds = view.referral.current_wave;
  return (
    <View style={{ gap: 10 }}>
      <Callout kind="error" title={`No hospital accepted after ${rounds} round${rounds === 1 ? "" : "s"} (${calls} calls)`}>
        Call these desks directly, or widen the search.
      </Callout>
      <Card style={{ gap: 14 }}>
        {[...cards].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((a) => (
          <View key={a.id} style={{ gap: 6 }}>
            <Text style={styles.name}>{`${a.rank ?? "•"}. ${shortName(a.facility_name)}`}</Text>
            <Text style={styles.meta}>{`${a.eta_minutes ?? "?"} min · last answer: ${attemptDisplay(a, Date.now()).text}`}</Text>
            <Button compact icon="phone" label={a.to_number} onPress={() => void Linking.openURL(`tel:${a.to_number}`)} />
          </View>
        ))}
      </Card>
      <Button variant="primary" icon="rotate-cw" label="Widen to 80 km and try again" onPress={onWiden} testID="widen" />
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: font.md, fontWeight: "600", color: color.text },
  meta: { fontSize: font.sm, color: color.muted },
});
