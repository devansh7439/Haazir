import { StyleSheet, Text, View } from 'react-native';
import FilterChip from '../../../components/ui/FilterChip';
import TextField from '../../../components/ui/TextField';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';
import Pick from './Pick';
import { AIRWAY, BREATHING, CONSCIOUS, GIVEN, ONSET, PAYER, YES_NO, gcsValid, spo2Valid, type Clinical } from '../clinical.helper';

/**
 * What the receiving emergency team needs first, as taps: awake or not, breathing, how long ago it began, the last readings
 * and what has been done. Everything is optional; what is picked is read to hospitals in the note.
 */
export default function ClinicalDetails({ clinical, onChange }: { clinical: Clinical; onChange: (clinical: Clinical) => void }) {
  const set = <K extends keyof Clinical>(key: K, value: Clinical[K]) => onChange({ ...clinical, [key]: value });
  return (
    <View style={styles.wrap}>
      <Pick label={t('Awake?')} choices={CONSCIOUS} value={clinical.conscious} onChange={(v) => set('conscious', v)} />
      <Pick label={t('Breathing')} choices={BREATHING} value={clinical.breathing} onChange={(v) => set('breathing', v)} />
      <Pick label={t('Airway')} choices={AIRWAY} value={clinical.airway} onChange={(v) => set('airway', v)} />
      <Pick label={t('Since it began')} choices={ONSET} value={clinical.onset} onChange={(v) => set('onset', v)} />
      <View style={styles.vitals}>
        <View style={styles.vital}>
          <TextField
            appearance="plain"
            label={t('Oxygen (SpO₂ %)')}
            value={clinical.spo2}
            onChangeText={(v) => set('spo2', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
            placeholder={t('e.g. 94')}
            error={spo2Valid(clinical.spo2) ? null : t('Up to 100')}
            testID="spo2"
          />
        </View>
        <View style={styles.vital}>
          <TextField
            appearance="plain"
            label={t('Blood pressure')}
            value={clinical.bp}
            onChangeText={(v) => set('bp', v.replace(/[^\d/]/g, ''))}
            keyboardType="numbers-and-punctuation"
            maxLength={7}
            placeholder={t('e.g. 120/80')}
            testID="bp"
          />
        </View>
      </View>
      <View style={styles.vitals}>
        <View style={styles.vital}>
          <TextField
            appearance="plain"
            label={t('GCS (3 to 15)')}
            value={clinical.gcs}
            onChangeText={(v) => set('gcs', v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder={t('e.g. 9')}
            error={gcsValid(clinical.gcs) ? null : t('From 3 to 15')}
            testID="gcs"
          />
        </View>
        <View style={styles.vital} />
      </View>
      <Pick label={t('Payment')} choices={PAYER} value={clinical.payer} onChange={(v) => set('payer', v)} />
      <Pick label={t('Medico-legal case')} choices={YES_NO} value={clinical.medico} onChange={(v) => set('medico', v)} />
      <View style={styles.group}>
        <Text style={styles.label}>{t('Done so far')}</Text>
        <View style={styles.chips}>
          {GIVEN.map((g) => (
            <FilterChip
              key={g.value}
              label={t(g.label)}
              selected={clinical.given.includes(g.value)}
              onPress={() =>
                set('given', clinical.given.includes(g.value) ? clinical.given.filter((x) => x !== g.value) : [...clinical.given, g.value])
              }
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.l },
  group: { gap: theme.space.s },
  label: { ...theme.type.captionStrong, color: theme.tint.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
  vitals: { flexDirection: 'row', gap: theme.space.m },
  vital: { flex: 1 },
});
