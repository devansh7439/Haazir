import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import type { AttemptView, ReferralView } from "../../api/schema";
import { BED_LABEL, attemptDisplay, clock, shortName } from "../../lib/display";
import { callEnded } from "../../lib/board";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Card } from "../../ui/Card";
import { Pill } from "../../ui/Pill";
import { PIN_COLOR, TONE_COLOR, color, font } from "../../ui/theme";
import { ManualOutcome } from "./ManualOutcome";

const OPEN = ["options_ready", "searching", "exhausted"];

/** One hospital: its rank and drive time, its answer, what the desk said, and what the doctor can do next. */
export function AttemptCard(props: {
  a: AttemptView;
  calls: number;
  nowMs: number;
  referralStatus: string;
  isSelected: boolean;
  portalFlag: ReferralView["portal_flags"][string] | null;
  onSelect: () => void;
  act: (path: string, body?: unknown) => Promise<boolean>;
}) {
  const { a } = props;
  const d = attemptDisplay(a, props.nowMs);
  const accepted = a.outcome === "accepted" || a.outcome === "conditional";
  const canSelect = accepted && OPEN.includes(props.referralStatus);
  const canRedial = callEnded(a.status) && !accepted && OPEN.includes(props.referralStatus);
  const [more, setMore] = useState(a.needs_review);
  const [manual, setManual] = useState(false);
  return (
    <Card accent={TONE_COLOR[d.tone].accent} style={[styles.card, props.isSelected && styles.selected]}>
      <View style={styles.head}>
        <View style={[styles.rank, { backgroundColor: PIN_COLOR[d.tone] }]}>
          <Text style={styles.rankText}>{a.rank ?? "•"}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.name, d.group === "not_available" && { color: color.text2 }]}>
            {shortName(a.facility_name)}
            {props.isSelected ? "  ·  Selected" : ""}
          </Text>
          <Text style={styles.meta}>{`${a.eta_minutes ?? "?"} min away${a.distance_km !== null ? ` · ${a.distance_km} km` : ""}${props.calls > 1 ? ` · ${props.calls} calls` : ""}`}</Text>
        </View>
      </View>
      <Pill tone={d.tone} text={d.text} icon={d.icon} />

      {accepted && (
        <View style={styles.detail}>
          <Text style={styles.detailText}>
            {BED_LABEL[a.bed_type ?? "unknown"] ?? a.bed_type}
            {a.ready_in_minutes !== null ? ` · ready in ${a.ready_in_minutes} min` : ""}
          </Text>
          {a.contact_person ? <Text style={styles.detailText}>{`Ask for ${a.contact_person}`}</Text> : null}
          {a.conditions ? <Text style={[styles.detailText, { color: color.warnText }]}>{`Condition: ${a.conditions}`}</Text> : null}
        </View>
      )}
      {a.outcome === "needs_doctor" && a.conditions ? <Text style={styles.quote}>{`“${a.conditions}”${a.contact_person ? ` · ${a.contact_person}` : ""}`}</Text> : null}
      {a.needs_review ? (
        <Callout kind="warn">{`The answer is unclear (call: ${a.outcome ?? "none"}, transcript: ${a.extraction_outcome ?? "none"}). Listen to the recording before selecting.`}</Callout>
      ) : null}
      {props.portalFlag ? <Callout kind="warn">{`Desk and portal disagree: ${props.portalFlag.detail} at ${clock(props.portalFlag.observed_at)} (${props.portalFlag.source}).`}</Callout> : null}
      {a.contact_is_ivr ? <Text style={styles.meta}>Phone menu line only. A direct desk number works better.</Text> : null}

      <View style={styles.actions}>
        {canSelect && <Button variant="primary" label={a.needs_review ? "Select anyway" : "Select hospital"} onPress={props.onSelect} testID={`select-${a.rank}`} />}
        <Button icon="phone" label="Call desk" onPress={() => void Linking.openURL(`tel:${a.to_number}`)} />
        {canRedial && (
          <Button
            icon="rotate-cw"
            label="Redial"
            onPress={() => props.act(`/api/attempts/${a.id}/redial`, { contact_id: a.contact_id ?? undefined, to_number: a.contact_id ? undefined : a.to_number })}
          />
        )}
        <Button compact variant="ghost" icon={more ? "chevron-up" : "chevron-down"} label="More" onPress={() => setMore((m) => !m)} />
      </View>
      {more && (
        <View style={{ gap: 8 }}>
          <Button icon="edit-2" label={a.needs_review || a.outcome === "unclear" ? "Set outcome" : "Record outcome"} onPress={() => setManual(true)} />
          {a.recording_url ? <Button icon="headphones" label="Open recording" onPress={() => void Linking.openURL(a.recording_url!)} /> : null}
          {a.transcript ? <Text style={styles.transcript} selectable>{a.transcript}</Text> : null}
        </View>
      )}
      {manual && <ManualOutcome a={a} onClose={() => setManual(false)} onSave={(body) => props.act(`/api/attempts/${a.id}/manual-outcome`, body)} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, paddingLeft: 18 },
  selected: { borderColor: color.ok, borderWidth: 2 },
  head: { flexDirection: "row", gap: 12, alignItems: "center" },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rankText: { color: "#fff", fontWeight: "700", fontSize: font.sm },
  name: { fontSize: font.lg, fontWeight: "600", color: color.text },
  meta: { fontSize: font.sm, color: color.muted },
  detail: { backgroundColor: color.subtle, borderRadius: 12, padding: 12, gap: 4 },
  detailText: { fontSize: font.md, color: color.text },
  quote: { backgroundColor: color.warnBg, borderRadius: 12, padding: 12, fontSize: font.md, color: color.warnText },
  actions: { gap: 8 },
  transcript: { fontSize: font.sm, lineHeight: 20, color: color.text2, backgroundColor: color.subtle, borderRadius: 12, padding: 12 },
});
