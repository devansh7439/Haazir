import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Sheet } from "../../ui/Sheet";
import { color, font } from "../../ui/theme";

const REASONS = ["Patient stabilised", "Taken elsewhere", "Sent by mistake", "Other"];

/** Cancels the referral after asking why; the reason is stored with it. Hospitals still being called are released. */
export function CancelSheet({ onCancel, onClose }: { onCancel: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Cancel this referral?" onClose={onClose}>
      <Text style={{ fontSize: font.md, color: color.muted }}>Hospitals that are still being called, or are holding a bed, will be released.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {REASONS.map((r) => <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />)}
      </View>
      <Button
        label="Cancel referral"
        variant="danger"
        loading={busy}
        testID="confirm-cancel"
        onPress={async () => {
          setBusy(true);
          await onCancel(reason);
          onClose();
        }}
      />
      <Button label="Keep it" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
