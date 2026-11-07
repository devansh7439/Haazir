import { Linking, StyleSheet, Text, View } from "react-native";
import type { Alert } from "../../api/schema";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { color, font, radius } from "../../ui/theme";

/** Something that needs the doctor: a desk asking for them, a hospital calling back, or a system alert. */
export function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const system = alert.type === "alert";
  const who = alert.facility_name ?? "A hospital";
  const title = system ? alert.reason ?? alert.kind ?? "Alert" : `${who} ${alert.type === "inbound_callback" ? "called back" : "wants to talk to you"}${alert.contact_person ? ` · ${alert.contact_person}` : ""}`;
  return (
    <View accessibilityRole="alert" style={styles.box}>
      <View style={styles.head}>
        <Icon name={system ? "alert-triangle" : "phone-incoming"} size={18} color={color.warnText} style={{ marginTop: 2 }} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {!system && alert.reason ? <Text style={styles.reason}>{`“${alert.reason}”`}</Text> : null}
      <View style={{ gap: 8 }}>
        {alert.number ? <Button variant="primary" icon="phone" label={`Call desk · ${alert.number}`} onPress={() => void Linking.openURL(`tel:${alert.number}`)} /> : null}
        <Button label="Dismiss" variant="secondary" onPress={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: color.warnBg, borderRadius: radius.lg, borderWidth: 1, borderColor: "#facc15", padding: 14, gap: 10 },
  head: { flexDirection: "row", gap: 10 },
  title: { flex: 1, fontSize: font.md, fontWeight: "700", color: color.warnText },
  reason: { fontSize: font.md, color: color.text2 },
});
