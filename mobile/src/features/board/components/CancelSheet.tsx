import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from '../../../components/ui/BottomSheet';
import Button from '../../../components/ui/Button';
import FilterChip from '../../../components/ui/FilterChip';
import { phrase, t } from '../../../lib/i18n';
import theme from '../../../theme';

// The reason is stored with the referral in English, whatever language the screen is in; only its label is translated.
const REASONS = [
  { value: 'Patient stabilised', label: phrase('Patient stabilised') },
  { value: 'Taken elsewhere', label: phrase('Taken elsewhere') },
  { value: 'Sent by mistake', label: phrase('Sent by mistake') },
  { value: 'Other', label: phrase('Other') },
] as const;

/** Cancels the referral after asking why; the reason is stored with it. Hospitals still being called are released. */
export default function CancelSheet({ onCancel, onClose }: { onCancel: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={t('Cancel this referral?')}
      footer={
        <>
          <Button
            label={t('Cancel referral')}
            variant="danger"
            loading={busy}
            testID="confirm-cancel"
            onPress={async () => {
              setBusy(true);
              await onCancel(reason);
              onClose();
            }}
          />
          <Button label={t('Keep it')} variant="text" onPress={onClose} />
        </>
      }
    >
      <Text style={styles.body}>{t('Hospitals that are still being called, or are holding a bed, will be released.')}</Text>
      <View style={styles.chips}>
        {REASONS.map((r) => (
          <FilterChip key={r.value} label={t(r.label)} selected={reason === r.value} onPress={() => setReason(r.value)} />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { ...theme.type.secondary, color: theme.color.textSecondary, marginBottom: theme.space.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
});
