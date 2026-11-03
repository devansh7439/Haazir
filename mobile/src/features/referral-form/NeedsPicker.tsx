import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Capability } from "../../api/schema";
import { groupByCategory } from "../../lib/facility";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { color, font } from "../../ui/theme";

/** What the hospital must have. Starts from the case's defaults; tap to add or remove. */
export function NeedsPicker({ capabilities, needs, onToggle }: { capabilities: Capability[]; needs: string[]; onToggle: (code: string) => void }) {
  const [editing, setEditing] = useState(false);
  const byCode = new Map(capabilities.map((c) => [c.code, c]));
  const selected = needs.map((n) => byCode.get(n)).filter((c): c is Capability => !!c);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>The hospital must have</Text>
      {!editing ? (
        <View style={styles.row}>
          {selected.map((c) => <Chip key={c.code} label={c.label} selected onPress={() => onToggle(c.code)} />)}
          {selected.length === 0 && <Text style={styles.empty}>Nothing chosen yet</Text>}
        </View>
      ) : (
        groupByCategory(capabilities).map((g) => (
          <View key={g.category} style={{ gap: 6 }}>
            <Text style={styles.group}>{g.title}</Text>
            <View style={styles.row}>
              {g.items.map((c) => <Chip key={c.code} testID={`need-${c.code}`} label={c.label} selected={needs.includes(c.code)} onPress={() => onToggle(c.code)} />)}
            </View>
          </View>
        ))
      )}
      <Button compact variant="ghost" icon={editing ? "check" : "edit-2"} label={editing ? "Done" : "Change needs"} onPress={() => setEditing((e) => !e)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: font.sm, fontWeight: "600", color: color.text2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  group: { fontSize: font.xs, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  empty: { fontSize: font.sm, color: color.muted },
});
