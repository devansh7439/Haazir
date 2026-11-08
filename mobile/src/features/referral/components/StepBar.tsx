import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../../../components/ui/Icon';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

const MARK = 26;

export type Step = { title: string; done: boolean };

/**
 * Where the doctor is in the form: a numbered circle per step (a tick once it is done) joined by thin lines, and under
 * A finished step can be tapped to go back to it; the card below carries the step's number and name.
 */
export default function StepBar({ steps, current, onJump }: { steps: Step[]; current: number; onJump: (index: number) => void }) {
  return (
    <View>
      <View style={styles.marks}>
        {steps.map((step, index) => {
          const open = index === current;
          const reachable = index < current;
          return (
            <Fragment key={step.title}>
              {index > 0 ? <View style={[styles.line, index <= current && styles.lineDone]} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Step {step}: {title}', { step: index + 1, title: step.title })}
                accessibilityState={{ selected: open, disabled: !reachable }}
                disabled={!reachable}
                onPress={() => onJump(index)}
                hitSlop={8}
                style={[styles.mark, (step.done || open) && styles.markOn, open && styles.markOpen]}
              >
                {step.done && !open ? (
                  <Icon name="check" size={14} color={theme.color.onPrimary} />
                ) : (
                  <Text style={[styles.markText, open && styles.markTextOn]}>{index + 1}</Text>
                )}
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  marks: { flexDirection: 'row', alignItems: 'center' },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
  },
  markOn: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  markOpen: { backgroundColor: theme.color.surface },
  markText: { ...theme.type.label, color: theme.tint.muted },
  markTextOn: { color: theme.color.primary },
  line: { flex: 1, height: 1, marginHorizontal: theme.space.xs, backgroundColor: theme.color.border },
  lineDone: { backgroundColor: theme.color.primary },
});
