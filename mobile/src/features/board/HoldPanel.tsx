import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AttemptView, ReferralView } from "../../api/schema";
import { LANGUAGE_LABEL, attemptDisplay, clock, shortName } from "../../lib/display";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Card } from "../../ui/Card";
import { Icon } from "../../ui/Icon";
import { Pill } from "../../ui/Pill";
import { color, font, radius } from "../../ui/theme";
import { CancelSheet } from "./CancelSheet";

const MESSAGES = [
  { aud: "receiving_facility", label: "Pre-arrival note to hospital" },
  { aud: "referrer", label: "Confirmation to you" },
  { aud: "family", label: "Family update" },
];

const ended = (a: AttemptView) => ["no_answer", "busy", "failed"].includes(a.status);

/** After a hospital is chosen: the bed hold, the WhatsApp handoff, the family call and the released hospitals. */
export function HoldPanel(props: {
  view: ReferralView;
  hold: AttemptView | null;
  releases: AttemptView[];
  holdExpired: boolean;
  facilityName: (id: unknown) => string;
  act: (path: string, body?: unknown) => Promise<boolean>;
}) {
  const { view, hold } = props;
  const r = view.referral;
  const selected = view.attempts.find((a) => a.id === r.selected_attempt_id);
  const name = shortName(selected?.facility_name ?? hold?.facility_name);
  const contact = hold?.contact_person || selected?.contact_person;
  const [cancelling, setCancelling] = useState(false);
  const [previews, setPreviews] = useState(false);

  if (r.status === "confirming") {
    const d = hold ? attemptDisplay(hold, Date.now()) : null;
    return <Callout kind="info" title={`Confirming the bed with ${name}`}>{d ? `${d.text}. The desk is being asked to keep the bed ready.` : "Placing the confirmation call…"}</Callout>;
  }
  const family = view.attempts.filter((a) => a.purpose === "family_update");
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      {r.status === "confirmed" ? (
        <View style={styles.held} testID="bed-held">
          <Icon name="lock" size={22} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.heldTitle}>{`Bed held at ${name}`}</Text>
            <Text style={styles.heldSub}>
              {`Until ${clock(r.hold_expires_at)}${contact ? ` · ask for ${contact}` : ""}${selected?.eta_minutes ? ` · ${selected.eta_minutes} min away` : ""}`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.section}><Text style={styles.heading}>Referral cancelled · releasing hospitals that said yes</Text></View>
      )}

      {view.messages.length > 0 && (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.eyebrow}>WhatsApp handoff</Text>
            <Button compact variant="ghost" label={previews ? "Hide previews" : "Show previews"} onPress={() => setPreviews((p) => !p)} />
          </View>
          {MESSAGES.map(({ aud, label }) => {
            const m = view.messages.find((x) => x.audience === aud);
            if (!m) return null;
            return (
              <View key={aud} style={{ gap: 6 }}>
                <View style={styles.row}>
                  <Text style={styles.item}>{label}</Text>
                  <Pill small tone={m.status === "failed" ? "red" : m.status === "simulated" ? "grey" : "green"} text={m.status === "simulated" ? "not sent" : m.status} icon={m.status === "failed" ? "x" : "check"} />
                </View>
                {previews ? <Text style={styles.preview}>{m.preview_redacted}</Text> : null}
              </View>
            );
          })}
        </View>
      )}

      {family.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Family</Text>
          {family.map((a) => {
            const done = a.outcome === "family_informed";
            return (
              <View key={a.id} style={styles.row}>
                <Text style={styles.item}>{`Update call (${LANGUAGE_LABEL[a.call_language] ?? a.call_language})`}</Text>
                <Pill small tone={done ? "green" : ended(a) ? "dark" : "amber"} text={done ? "Informed" : ended(a) ? "No answer" : "Calling"} icon={done ? "check" : ended(a) ? "ban" : "oncall"} />
              </View>
            );
          })}
        </View>
      )}

      {props.releases.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Released</Text>
          {props.releases.map((a) => {
            const done = a.outcome === "release_ack";
            return (
              <View key={a.id} style={styles.row}>
                <Text style={styles.item}>{props.facilityName(a.facility_id)}</Text>
                <Pill small tone={done ? "green" : ended(a) ? "dark" : "amber"} text={done ? "Released" : ended(a) ? "No answer" : "Calling"} icon={done ? "check" : ended(a) ? "ban" : "oncall"} />
              </View>
            );
          })}
        </View>
      )}

      {r.status === "confirmed" && (
        <View style={[styles.section, { gap: 8 }]}>
          {props.holdExpired ? <Text style={styles.expired}>Hold expired. Did the patient arrive?</Text> : null}
          <Button variant="primary" icon="check" label="Patient arrived" testID="patient-arrived" onPress={() => props.act(`/api/referrals/${r.id}/close`, { reason: "arrived" })} />
          {props.holdExpired ? <Button label="Close" onPress={() => props.act(`/api/referrals/${r.id}/close`, { reason: "hold_expired" })} /> : null}
          <Button variant="danger" label="Cancel referral" onPress={() => setCancelling(true)} />
        </View>
      )}
      {cancelling && <CancelSheet onClose={() => setCancelling(false)} onCancel={async (reason) => void (await props.act(`/api/referrals/${r.id}/cancel`, { reason }))} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  held: { backgroundColor: color.ok, flexDirection: "row", gap: 12, padding: 16, alignItems: "center", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  heldTitle: { color: "#fff", fontSize: font.lg, fontWeight: "700" },
  heldSub: { color: "#dcfce7", fontSize: font.sm, marginTop: 2 },
  section: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: color.line },
  heading: { fontSize: font.md, fontWeight: "700", color: color.text },
  eyebrow: { fontSize: font.xs, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  item: { flex: 1, fontSize: font.md, color: color.text },
  preview: { fontSize: font.sm, color: color.text2, backgroundColor: color.subtle, borderRadius: 12, padding: 10, lineHeight: 19 },
  expired: { fontSize: font.md, fontWeight: "600", color: color.warnText },
});
