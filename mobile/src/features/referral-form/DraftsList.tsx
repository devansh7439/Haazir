import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { api } from "../../api/client";
import { DraftsSchema, type Draft } from "../../api/schema";
import { useLoad } from "../../api/useLoad";
import { clock } from "../../lib/display";
import { Button } from "../../ui/Button";
import { Card, SectionTitle } from "../../ui/Card";
import { Icon } from "../../ui/Icon";
import { color, font } from "../../ui/theme";

/** Referrals doctors sent by WhatsApp text or voice note. Review pre-fills the form; nothing is started until Find a bed. */
export function DraftsList({ onReview }: { onReview: (d: Draft) => void }) {
  const { data, reload } = useLoad(() => api("/api/intake-drafts", DraftsSchema), []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const drafts = data?.drafts ?? [];
  if (drafts.length === 0) return null;
  return (
    <View style={{ gap: 8 }} testID="drafts">
      <SectionTitle count={drafts.length}>From WhatsApp</SectionTitle>
      <Card style={{ gap: 14 }}>
        {drafts.map((d) => (
          <View key={d.id} style={{ gap: 8 }}>
            <View style={styles.row}>
              <Icon name={d.kind === "voice" ? "mic" : "message-circle"} size={16} color={color.faint} />
              <Text style={styles.what}>{d.parsed.matched.length ? d.parsed.matched.join(" · ") : "Case not recognised"}</Text>
              <Text style={styles.time}>{clock(d.created_at)}</Text>
            </View>
            <View style={styles.row}>
              <Button compact label="Review" variant="secondary" onPress={() => onReview(d)} testID={`review-${d.id}`} style={{ flex: 1 }} />
              <Button
                compact
                label="Dismiss"
                variant="ghost"
                onPress={async () => {
                  await api(`/api/intake-drafts/${d.id}/dismiss`, z.unknown(), { method: "POST", body: {} }).catch(() => {});
                  await reload();
                }}
              />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  what: { flex: 1, fontSize: font.md, color: color.text },
  time: { fontSize: font.xs, color: color.faint },
});
