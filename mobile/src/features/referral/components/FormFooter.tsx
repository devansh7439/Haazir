import { StyleSheet, Text, View } from 'react-native';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** The form's bottom bar: Previous, then Next (or "Find a bed" on the review step), with any send error and a hint under it. */
export default function FormFooter(props: {
  step: number;
  onReview: boolean;
  submitError: string | null;
  submitting: boolean;
  canSubmit: boolean;
  /** Why Next is off, or what is missing on the review step; null when nothing is. */
  hint: string | null;
  nextBlocked: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      {props.submitError ? <Banner tone="alert" title={props.submitError} /> : null}
      <View style={styles.nav}>
        <View style={styles.grow}>
          {props.step > 0 ? <Button label={t('Previous')} icon="back" variant="secondary" onPress={props.onPrevious} testID="step-back" /> : null}
        </View>
        <View style={styles.grow}>
          {props.onReview ? (
            <Button label={t('Find a bed')} icon="phone-call" loading={props.submitting} disabled={!props.canSubmit} onPress={props.onSubmit} testID="find-a-bed" />
          ) : (
            <Button label={t('Next')} disabled={props.nextBlocked} onPress={props.onNext} testID="step-next" />
          )}
        </View>
      </View>
      {props.hint ? <Text style={styles.hint}>{props.hint}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  hint: { ...theme.type.caption, color: theme.tint.muted, textAlign: 'center' },
  nav: { flexDirection: 'row', gap: theme.space.s },
  grow: { flex: 1 },
});
