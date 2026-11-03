import { useState } from "react";
import { Text } from "react-native";
import type { AttemptView } from "../../api/schema";
import { shortName } from "../../lib/display";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Field } from "../../ui/Field";
import { Sheet } from "../../ui/Sheet";
import { color, font } from "../../ui/theme";

/** Confirms the choice of hospital: Haazir calls the desk to hold the bed, or the doctor says they already did. */
export function SelectSheet(props: {
  a: AttemptView;
  onClose: () => void;
  onConfirmCall: () => Promise<void>;
  onConfirmManual: (contact: string) => Promise<void>;
}) {
  const { a } = props;
  const [manual, setManual] = useState(false);
  const [contact, setContact] = useState(a.contact_person ?? "");
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    await work();
    props.onClose();
  };
  return (
    <Sheet title={`Send the patient to ${shortName(a.facility_name)}?`} onClose={props.onClose}>
      <Text style={{ fontSize: font.md, color: color.muted, lineHeight: 22 }}>
        {`About ${a.eta_minutes ?? "?"} min away. Haazir calls the desk to confirm the bed, sends the pre-arrival note on WhatsApp and releases the other hospitals.`}
      </Text>
      {a.needs_review ? <Callout kind="warn">Their answer was flagged as unclear. Only continue if you listened to the recording.</Callout> : null}
      {manual ? (
        <>
          <Field label="Who confirmed? (optional)" value={contact} onChangeText={setContact} testID="confirm-contact" />
          <Button label="Mark bed confirmed" variant="primary" loading={busy} onPress={() => run(() => props.onConfirmManual(contact))} testID="confirm-manual" />
        </>
      ) : (
        <>
          <Button label="Confirm and call" icon="phone-call" variant="primary" loading={busy} onPress={() => run(props.onConfirmCall)} testID="confirm-call" />
          <Button label="I already confirmed by phone" onPress={() => setManual(true)} />
        </>
      )}
      <Button label="Back" variant="ghost" onPress={props.onClose} />
    </Sheet>
  );
}
