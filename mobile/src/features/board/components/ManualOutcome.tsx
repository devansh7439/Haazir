import { useState } from "react";
import { Text, View } from "react-native";
import type { AttemptView } from "../../api/schema";
import { BED_LABEL } from "../../lib/display";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { color, font } from "../../ui/theme";

const OUTCOMES = [
  { value: "accepted", label: "Accepted" },
  { value: "conditional", label: "Accepted with a condition" },
  { value: "declined", label: "Declined" },
  { value: "callback_later", label: "Call back later" },
  { value: "unclear", label: "Unclear" },
] as const;
type OutcomeValue = (typeof OUTCOMES)[number]["value"];
const BEDS = Object.keys(BED_LABEL).filter((k) => k !== "none" && k !== "unknown");

const Label = ({ children }: { children: string }) => <Text style={{ fontSize: font.sm, fontWeight: "600", color: color.text2 }}>{children}</Text>;

/** Records what a desk said on a phone call the doctor made themselves. */
export function ManualOutcome({ a, onSave, onClose }: { a: AttemptView; onSave: (body: Record<string, unknown>) => Promise<boolean>; onClose: () => void }) {
  const start = (a.outcome && OUTCOMES.some((o) => o.value === a.outcome) && a.outcome !== "unclear" ? a.outcome : "accepted") as OutcomeValue;
  const [outcome, setOutcome] = useState<OutcomeValue>(start);
  const [bed, setBed] = useState(a.bed_type && BEDS.includes(a.bed_type) ? a.bed_type : "icu_with_ventilator");
  const [ready, setReady] = useState(a.ready_in_minutes?.toString() ?? "");
  const [contact, setContact] = useState(a.contact_person ?? "");
  const [conditions, setConditions] = useState(a.conditions ?? "");
  const [reason, setReason] = useState(a.decline_reason ?? "");
  const [busy, setBusy] = useState(false);
  const accepted = outcome === "accepted" || outcome === "conditional";
  return (
    <Sheet title="What did the desk tell you?" onClose={onClose}>
      <Label>Outcome</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {OUTCOMES.map((o) => <Chip key={o.value} testID={`outcome-${o.value}`} label={o.label} selected={o.value === outcome} onPress={() => setOutcome(o.value)} />)}
      </View>
      {accepted && (
        <>
          <Label>Bed type</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {BEDS.map((b) => <Chip key={b} label={BED_LABEL[b]} selected={b === bed} onPress={() => setBed(b)} />)}
          </View>
          <Field label="Ready in (minutes)" value={ready} onChangeText={(t) => setReady(t.replace(/\D/g, ""))} keyboardType="number-pad" />
        </>
      )}
      <Field label="Contact person" value={contact} onChangeText={setContact} />
      {outcome === "conditional" && <Field label="Condition" value={conditions} onChangeText={setConditions} />}
      {outcome === "declined" && <Field label="Reason" value={reason} onChangeText={setReason} />}
      <Button
        label="Save outcome"
        variant="primary"
        loading={busy}
        testID="save-outcome"
        onPress={async () => {
          setBusy(true);
          const ok = await onSave({
            outcome,
            bed_type: accepted ? bed : null,
            ready_in_minutes: ready ? Number(ready) : null,
            contact_person: contact.trim() || null,
            conditions: outcome === "conditional" ? conditions.trim() || null : null,
            decline_reason: outcome === "declined" ? reason.trim() || null : null,
          });
          setBusy(false);
          if (ok) onClose();
        }}
      />
      <Button label="Cancel" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
