import { StyleSheet, Text, View } from 'react-native';
import Button from '../../../components/ui/Button';
import FilterChip from '../../../components/ui/FilterChip';
import SwitchRow from '../../../components/ui/SwitchRow';
import TextField from '../../../components/ui/TextField';
import { LANGUAGE_LABEL } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';
import { FAMILY_LANGUAGES, type PatientFields } from '../referralOptions';

/** Private patient and family details. Shared with a hospital only after it accepts, and with the family only with consent. */
export default function PatientDetails({
  open,
  onToggle,
  patient,
  onChange,
}: {
  open: boolean;
  onToggle: () => void;
  patient: PatientFields;
  onChange: (patient: PatientFields) => void;
}) {
  const set = <K extends keyof PatientFields>(key: K, value: PatientFields[K]) => onChange({ ...patient, [key]: value });
  return (
    <View style={styles.wrap}>
      <Button
        variant="secondary"
        size="medium"
        icon={open ? 'chevron-up' : 'chevron-down'}
        label={t('Patient and family details')}
        onPress={onToggle}
        testID="patient-toggle"
      />
      {open ? (
        <View style={styles.wrap}>
          <Text style={styles.hint}>{t('Never spoken on the availability calls. A hospital gets them only after it says yes.')}</Text>
          <TextField
            appearance="plain"
            label={t('Patient name')}
            value={patient.patient_name}
            onChangeText={(text) => set('patient_name', text)}
            testID="patient_name"
          />
          <TextField
            appearance="plain"
            label={t('Family contact name')}
            value={patient.attendant_name}
            onChangeText={(text) => set('attendant_name', text)}
            testID="attendant_name"
          />
          <TextField
            appearance="plain"
            label={t('Family contact phone')}
            value={patient.attendant_phone}
            onChangeText={(text) => set('attendant_phone', text)}
            keyboardType="phone-pad"
            placeholder={t('10-digit mobile')}
            testID="attendant_phone"
          />
          <View style={styles.group}>
            <Text style={styles.label}>{t('Family’s language')}</Text>
            <View style={styles.chips}>
              {FAMILY_LANGUAGES.map((code) => (
                <FilterChip
                  key={code}
                  label={t(LANGUAGE_LABEL[code] ?? code)}
                  selected={patient.attendant_language === code}
                  onPress={() => set('attendant_language', code)}
                />
              ))}
            </View>
          </View>
          <SwitchRow
            title={t('The family agreed')}
            subtitle={t(
              'They agreed to their details being shared and to a WhatsApp message and a call. Without this the family is left alone.',
            )}
            value={patient.attendant_consent}
            onValueChange={(agreed) => set('attendant_consent', agreed)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.m },
  group: { gap: theme.space.s },
  label: { ...theme.type.captionStrong, color: theme.tint.ink },
  hint: { ...theme.type.caption, color: theme.tint.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
});
