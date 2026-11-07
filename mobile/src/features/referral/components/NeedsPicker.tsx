import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Capability } from '../../../api/schema';
import Button from '../../../components/ui/Button';
import FilterChip from '../../../components/ui/FilterChip';
import { groupByCategory } from '../../../lib/facility';
import { t } from '../../../lib/i18n';
import { animateLayout } from '../../../lib/motion';
import theme from '../../../theme';

/** What the hospital must have. Starts from the case's defaults; tap to add or remove. */
export default function NeedsPicker({
  capabilities,
  needs,
  onToggle,
}: {
  capabilities: Capability[];
  needs: string[];
  onToggle: (code: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const byCode = new Map(capabilities.map((c) => [c.code, c]));
  const selected = needs.map((n) => byCode.get(n)).filter((c): c is Capability => !!c);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('The hospital must have')}</Text>
      {!editing ? (
        <View style={styles.chips}>
          {selected.map((c) => (
            <FilterChip key={c.code} label={c.label} selected onPress={() => onToggle(c.code)} />
          ))}
          {selected.length === 0 ? <Text style={styles.empty}>{t('Nothing chosen yet')}</Text> : null}
        </View>
      ) : (
        groupByCategory(capabilities).map((g) => (
          <View key={g.category} style={styles.group}>
            <Text style={styles.groupTitle}>{t(g.title)}</Text>
            <View style={styles.chips}>
              {g.items.map((c) => (
                <FilterChip key={c.code} label={c.label} selected={needs.includes(c.code)} onPress={() => onToggle(c.code)} />
              ))}
            </View>
          </View>
        ))
      )}
      <Button
        size="small"
        variant="text"
        icon={editing ? 'check' : 'edit'}
        label={editing ? t('Done') : t('Change needs')}
        onPress={() => {
          animateLayout();
          setEditing((open) => !open);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.s },
  label: { ...theme.type.captionStrong, color: theme.tint.ink },
  group: { gap: theme.space.s },
  groupTitle: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
  empty: { ...theme.type.caption, color: theme.tint.muted },
});
