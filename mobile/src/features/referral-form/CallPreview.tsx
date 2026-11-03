import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Preview } from "../../api/schema";
import { LANGUAGE_LABEL } from "../../lib/display";
import { Callout } from "../../ui/Callout";
import { Card, SectionTitle } from "../../ui/Card";
import { color, font } from "../../ui/theme";

/** What hospitals will hear, and which of them will be phoned. */
export function CallPreview({ preview, loading, error }: { preview: Preview | null; loading: boolean; error: string | null }) {
  if (!preview && !error) {
    return loading ? <ActivityIndicator color={color.brand} /> : <Text style={styles.hint}>Choose a case to see what hospitals will hear.</Text>;
  }
  const willCall = preview?.eligible.filter((e) => e.will_call) ?? [];
  return (
    <View style={{ gap: 10 }}>
      {error ? <Callout kind="error">{error}</Callout> : null}
      {preview?.spoken_summary ? (
        <Card style={{ gap: 6 }}>
          <Text style={styles.label}>What hospitals will hear</Text>
          <Text style={styles.quote} testID="spoken-summary">{preview.spoken_summary}</Text>
        </Card>
      ) : null}
      {preview && (
        <>
          <SectionTitle count={willCall.length}>Hospitals to call</SectionTitle>
          {willCall.length === 0 ? (
            <Callout kind="warn" title="No hospital to call">{preview.suggestions[0] ?? "Widen the search distance or change the needs."}</Callout>
          ) : (
            <Card style={{ gap: 10 }}>
              {willCall.map((e) => (
                <View key={e.facility_id} style={styles.row}>
                  <Text style={styles.name}>{e.name.replace(/\s*\(Demo\)\s*/i, "")}</Text>
                  <Text style={styles.meta}>{`${e.eta_minutes} min · ${LANGUAGE_LABEL[e.call_language] ?? e.call_language}`}</Text>
                </View>
              ))}
            </Card>
          )}
          {preview.skipped_far ? <Text style={styles.hint}>{`${preview.skipped_far} more hospitals are too far to call first.`}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: font.sm, color: color.muted },
  label: { fontSize: font.xs, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  quote: { fontSize: font.md, color: color.text, lineHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { fontSize: font.md, fontWeight: "600", color: color.text, flex: 1 },
  meta: { fontSize: font.sm, color: color.muted },
});
