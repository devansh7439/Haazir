import { StyleSheet, Text, View } from 'react-native';
import type { Capability } from '../../../api/schema';
import BottomSheet from '../../../components/ui/BottomSheet';
import Button from '../../../components/ui/Button';
import FilterChip from '../../../components/ui/FilterChip';
import { groupByCategory } from '../../../lib/facility';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** The services a hospital must offer to be listed; the button shows how many hospitals that leaves. */
export default function ServiceFilterSheet(props: {
  visible: boolean;
  onClose: () => void;
  capabilities: Capability[];
  selected: string[];
  onToggle: (code: string) => void;
  onClear: () => void;
  matching: number;
}) {
  return (
    <BottomSheet
      visible={props.visible}
      onClose={props.onClose}
      title={t('Filter by service')}
      footer={
        <>
          <Button
            label={props.matching === 1 ? t('Show 1 hospital') : t('Show {count} hospitals', { count: props.matching })}
            onPress={props.onClose}
            testID="filter-done"
          />
          {props.selected.length > 0 ? <Button label={t('Clear')} variant="text" onPress={props.onClear} /> : null}
        </>
      }
    >
      <View style={styles.groups}>
        {groupByCategory(props.capabilities).map((g) => (
          <View key={g.category} style={styles.group}>
            <Text style={styles.groupTitle}>{t(g.title)}</Text>
            <View style={styles.chips}>
              {g.items.map((c) => (
                <FilterChip
                  key={c.code}
                  label={c.label}
                  selected={props.selected.includes(c.code)}
                  onPress={() => props.onToggle(c.code)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  groups: { gap: theme.space.l },
  group: { gap: theme.space.s },
  groupTitle: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
});
