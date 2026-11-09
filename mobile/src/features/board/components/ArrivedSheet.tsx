import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import BottomSheet from '../../../components/ui/BottomSheet';
import Button from '../../../components/ui/Button';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** Asks before recording that the patient arrived: it closes the referral, and a closed referral can't be reopened. */
export default function ArrivedSheet({ onArrived, onClose }: { onArrived: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={t('Has the patient arrived?')}
      footer={
        <>
          <Button
            icon="check"
            label={t('Yes, patient arrived')}
            loading={busy}
            testID="confirm-arrived"
            onPress={async () => {
              setBusy(true);
              await onArrived();
              onClose();
            }}
          />
          <Button label={t('Not yet')} variant="text" onPress={onClose} />
        </>
      }
    >
      <Text style={styles.body}>{t('This closes the referral. It can’t be reopened.')}</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { ...theme.type.secondary, color: theme.color.textSecondary },
});
