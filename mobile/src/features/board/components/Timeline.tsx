import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ReferralView } from "../../api/schema";
import { clock, eventText } from "../../lib/display";
import { Button } from "../../ui/Button";
import { Card, SectionTitle } from "../../ui/Card";
import { color, font } from "../../ui/theme";

const COLLAPSED = 6;

/** Every event in plain words, newest first. Each is timestamped, so the record is auditable. */
export function Timeline({ view, facilityName }: { view: ReferralView; facilityName: (id: unknown) => string }) {
  const [all, setAll] = useState(false);
  const lines = [...view.events]
    .reverse()
    .map((e) => ({ id: e.id, at: e.created_at, text: eventText(e, facilityName) }))
    .filter((l): l is { id: number; at: string; text: string } => l.text !== null);
  const shown = all ? lines : lines.slice(0, COLLAPSED);
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle count={lines.length}>Activity</SectionTitle>
      <Card style={{ gap: 10 }}>
        {shown.map((l) => (
          <View key={l.id} style={styles.line}>
            <Text style={styles.time}>{clock(l.at)}</Text>
            <Text style={styles.text}>{l.text}</Text>
          </View>
        ))}
        {lines.length > COLLAPSED && <Button compact variant="ghost" label={all ? "Show fewer" : `Show all ${lines.length} events`} onPress={() => setAll((a) => !a)} />}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", gap: 12 },
  time: { width: 44, fontSize: font.sm, color: color.faint, fontVariant: ["tabular-nums"] },
  text: { flex: 1, fontSize: font.md, color: color.text2, lineHeight: 20 },
});
