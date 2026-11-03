import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../api/client";
import { FacilityListSchema, type FacilityListItem } from "../../api/schema";
import { useLoad } from "../../api/useLoad";
import { LANGUAGE_LABEL } from "../../lib/display";
import { CONTACT_ROLE_LABEL, KIND_LABEL, OWNERSHIP_LABEL, filterFacilities, groupByCategory, mapsLink, telLink } from "../../lib/facility";
import { useSignedIn } from "../../session/SessionProvider";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Card } from "../../ui/Card";
import { Field } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { Screen } from "../../ui/Screen";
import { color, font } from "../../ui/theme";

function Hospital({ f, open, onToggle, labels }: { f: FacilityListItem; open: boolean; onToggle: () => void; labels: Map<string, { code: string; label: string; spoken_en: string; category: string }> }) {
  const groups = groupByCategory([...labels.values()], f.capabilities);
  const contacts = f.contacts.filter((c) => c.active).sort((a, b) => Number(a.is_ivr) - Number(b.is_ivr) || a.priority - b.priority);
  return (
    <Card style={{ gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{f.name.replace(/\s*\(Demo\)\s*/i, "")}</Text>
          <Text style={styles.meta}>
            {[KIND_LABEL[f.kind] ?? f.kind, f.city ?? f.district, LANGUAGE_LABEL[f.call_language] ?? f.call_language].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} color={color.faint} />
      </Pressable>
      {open && (
        <View style={{ gap: 12 }}>
          {f.address ? <Text style={styles.body}>{f.address}</Text> : null}
          <Text style={styles.body}>
            {OWNERSHIP_LABEL[f.ownership] ?? f.ownership}
            {f.availability_calls > 0 ? ` · answered ${f.answered} of ${f.availability_calls} calls, said yes to ${f.accepted}` : ""}
          </Text>
          {groups.map((g) => (
            <View key={g.category} style={{ gap: 2 }}>
              <Text style={styles.groupTitle}>{g.title}</Text>
              <Text style={styles.body}>{g.items.map((c) => c.label).join(", ")}</Text>
            </View>
          ))}
          {contacts.length === 0 ? <Callout kind="warn">No desk number yet. Add one on the web console.</Callout> : null}
          {contacts.map((c) => (
            <Button
              key={c.id}
              icon="phone"
              label={`${CONTACT_ROLE_LABEL[c.role] ?? c.role} · ${c.phone_e164}${c.is_ivr ? " (phone menu)" : ""}`}
              onPress={() => void Linking.openURL(telLink(c.phone_e164))}
            />
          ))}
          <Button icon="map-pin" label="Directions" variant="ghost" onPress={() => void Linking.openURL(mapsLink(f.lat, f.lng))} />
        </View>
      )}
    </Card>
  );
}

/** The directory: search by name or place, tap for services and desk numbers, call or get directions. */
export default function Hospitals() {
  const { boot } = useSignedIn();
  const { data, error, loading, refreshing, reload } = useLoad(() => api("/api/facilities", FacilityListSchema), []);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const labels = useMemo(() => new Map(boot.capabilities.map((c) => [c.code, c])), [boot.capabilities]);
  const rows = useMemo(() => filterFacilities(data?.facilities ?? [], query, []), [data, query]);
  return (
    <Screen title="Hospitals" subtitle={data ? `${data.facilities.length} hospitals in your network` : undefined} refreshing={refreshing} onRefresh={reload} testID="hospitals">
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Name, town or district" autoCapitalize="none" autoCorrect={false} testID="search" />
      {error ? <Callout kind="error">{error}</Callout> : null}
      {!loading && !error && rows.length === 0 ? <Callout>{query ? "No hospital matches that search." : "No hospitals listed yet."}</Callout> : null}
      {rows.map((f) => (
        <Hospital key={f.id} f={f} open={openId === f.id} onToggle={() => setOpenId(openId === f.id ? null : f.id)} labels={labels} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  name: { fontSize: font.lg, fontWeight: "600", color: color.text },
  meta: { fontSize: font.sm, color: color.muted },
  body: { fontSize: font.md, color: color.text2, lineHeight: 21 },
  groupTitle: { fontSize: font.xs, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.5 },
});
