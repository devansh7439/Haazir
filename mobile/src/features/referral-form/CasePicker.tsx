import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CaseTemplate } from "../../api/schema";
import { Chip } from "../../ui/Chip";
import { Button } from "../../ui/Button";
import { color, font } from "../../ui/theme";
import { FEATURED } from "./options";

/** The case: the commonest ones first, the rest under "More cases". */
export function CasePicker({ templates, caseType, onPick }: { templates: CaseTemplate[]; caseType: string; onPick: (t: CaseTemplate) => void }) {
  const featured = FEATURED.map((c) => templates.find((t) => t.case_type === c)).filter((t): t is CaseTemplate => !!t);
  const rest = templates.filter((t) => !FEATURED.includes(t.case_type));
  const pickedRest = rest.some((t) => t.case_type === caseType);
  const [more, setMore] = useState(false);
  const shown = more || pickedRest ? rest : [];
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>What is the case?</Text>
      <View style={styles.wrapRow}>
        {featured.map((t) => (
          <Chip key={t.case_type} testID={`case-${t.case_type}`} label={t.label} selected={t.case_type === caseType} onPress={() => onPick(t)} />
        ))}
        {shown.map((t) => (
          <Chip key={t.case_type} testID={`case-${t.case_type}`} label={t.label} selected={t.case_type === caseType} onPress={() => onPick(t)} />
        ))}
      </View>
      {rest.length > 0 && !pickedRest && <Button compact variant="ghost" label={more ? "Fewer cases" : `More cases (${rest.length})`} onPress={() => setMore((m) => !m)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: font.sm, fontWeight: "600", color: color.text2 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
