import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AttemptView } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import BottomSheet from '../../../components/ui/BottomSheet';
import Button from '../../../components/ui/Button';
import TextField from '../../../components/ui/TextField';
import { shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** Confirms the choice of hospital: Haazir calls the desk to hold the bed, or the doctor says they already did. */
export default function SelectSheet(props: {
  attempt: AttemptView;
  onClose: () => void;
  onConfirmCall: () => Promise<void>;
  onConfirmManual: (contact: string) => Promise<void>;
}) {
  const { attempt: a } = props;
  const [manual, setManual] = useState(false);
  const [contact, setContact] = useState(a.contact_person ?? '');
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    await work();
    props.onClose();
  };
  return (
    <BottomSheet
      visible
      onClose={props.onClose}
      title={t('Send the patient to {name}?', { name: shortName(a.facility_name) })}
      footer={
        <>
          {manual ? (
            <Button
              label={t('Mark bed confirmed')}
              loading={busy}
              onPress={() => run(() => props.onConfirmManual(contact))}
              testID="confirm-manual"
            />
          ) : (
            <>
              <Button
                label={t('Confirm and call')}
                icon="phone-call"
                loading={busy}
                onPress={() => run(props.onConfirmCall)}
                testID="confirm-call"
              />
              <Button label={t('I already confirmed by phone')} variant="secondary" onPress={() => setManual(true)} />
            </>
          )}
          <Button label={t('Back')} variant="text" onPress={props.onClose} />
        </>
      }
    >
      <View style={styles.body}>
        <Text style={styles.text}>
          {t(
            'About {minutes} min away. Haazir calls the desk to confirm the bed, sends the pre-arrival note on WhatsApp and releases the other hospitals.',
            { minutes: a.eta_minutes ?? '?' },
          )}
        </Text>
        {a.needs_review ? (
          <Banner tone="warning" title={t('Their answer was flagged as unclear. Only continue if you listened to the recording.')} />
        ) : null}
        {manual ? (
          <TextField
            appearance="plain"
            label={t('Who confirmed? (optional)')}
            value={contact}
            onChangeText={setContact}
            testID="confirm-contact"
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: theme.space.m }, text: { ...theme.type.secondary, color: theme.color.textSecondary } });
