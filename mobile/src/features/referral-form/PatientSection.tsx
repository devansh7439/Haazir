import { StyleSheet, Text, View } from "react-native";
import type { Acuity, AgeUnit, Sex } from "../../api/schema";
import { Callout } from "../../ui/Callout";
import { Segmented } from "../../ui/Chip";
import { Field } from "../../ui/Field";
import { color, font } from "../../ui/theme";
import { ACUITY, AGE_UNIT, NOTE_MAX, SEX } from "./options";

/** Acuity, age, sex and the short note. The note is spoken to hospitals, so it must not name anyone. */
export function PatientSection(props: {
  acuity: Acuity | "";
  onAcuity: (a: Acuity) => void;
  age: string;
  onAge: (v: string) => void;
  ageUnit: AgeUnit;
  onAgeUnit: (u: AgeUnit) => void;
  sex: Sex;
  onSex: (s: Sex) => void;
  note: string;
  onNote: (n: string) => void;
  noteErrors: string[];
  warnings: string[];
}) {
  const ageBad = props.age !== "" && !/^\d{1,3}$/.test(props.age);
  return (
    <View style={styles.wrap}>
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>How urgent?</Text>
        <Segmented value={props.acuity as Acuity} options={ACUITY} onChange={props.onAcuity} />
      </View>
      <Field label="Age" value={props.age} onChangeText={props.onAge} keyboardType="number-pad" placeholder="e.g. 34" error={ageBad ? "Enter a whole number" : null} testID="age" />
      <Segmented value={props.ageUnit} options={AGE_UNIT} onChange={props.onAgeUnit} />
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Sex</Text>
        <Segmented value={props.sex} options={SEX} onChange={props.onSex} />
      </View>
      <Field
        label={`Note for the hospital (${props.note.length}/${NOTE_MAX})`}
        value={props.note}
        onChangeText={props.onNote}
        maxLength={NOTE_MAX}
        multiline
        placeholder="Symptoms, time since onset, treatment given. No names or phone numbers."
        error={props.noteErrors[0] ?? null}
        testID="note"
      />
      {props.warnings.map((w) => <Callout key={w} kind="warn">{w}</Callout>)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  label: { fontSize: font.sm, fontWeight: "600", color: color.text2 },
});
