import { StyleSheet, Switch, Text, View } from "react-native";
import { LANGUAGE_LABEL } from "../../lib/display";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { color, font } from "../../ui/theme";
import type { PatientFields } from "./types";

/** Private patient and family details. Shared with a hospital only after it accepts, and with the family only with consent. */
export function PatientDetails({ open, onToggle, patient, onChange }: { open: boolean; onToggle: () => void; patient: PatientFields; onChange: (p: PatientFields) => void }) {
  const set = <K extends keyof PatientFields>(k: K, v: PatientFields[K]) => onChange({ ...patient, [k]: v });
  return (
    <View style={{ gap: 12 }}>
      <Button variant="secondary" icon={open ? "chevron-up" : "chevron-down"} label="Patient and family details" onPress={onToggle} testID="patient-toggle" />
      {open && (
        <View style={{ gap: 12 }}>
          <Text style={styles.hint}>Never spoken on the availability calls. A hospital gets them only after it says yes.</Text>
          <Field label="Patient name" value={patient.patient_name} onChangeText={(t) => set("patient_name", t)} testID="patient_name" />
          <Field label="Family contact name" value={patient.attendant_name} onChangeText={(t) => set("attendant_name", t)} testID="attendant_name" />
          <Field label="Family contact phone" value={patient.attendant_phone} onChangeText={(t) => set("attendant_phone", t)} keyboardType="phone-pad" placeholder="10-digit mobile" testID="attendant_phone" />
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Family's language</Text>
            <View style={styles.row}>
              {["en", "hi", "kn", "ta", "te", "ml", "mr"].map((l) => (
                <Chip key={l} label={LANGUAGE_LABEL[l] ?? l} selected={patient.attendant_language === l} onPress={() => set("attendant_language", l)} />
              ))}
            </View>
          </View>
          <View style={styles.consent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentTitle}>The family agreed</Text>
              <Text style={styles.hint}>They agreed to their details being shared and to a WhatsApp message and a call. Without this the family is left alone.</Text>
            </View>
            <Switch accessibilityLabel="The family agreed" value={patient.attendant_consent} onValueChange={(v) => set("attendant_consent", v)} trackColor={{ true: color.brand }} testID="consent" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.sm, fontWeight: "600", color: color.text2 },
  hint: { fontSize: font.xs, color: color.muted, lineHeight: 17 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  consent: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentTitle: { fontSize: font.md, fontWeight: "600", color: color.text },
});
