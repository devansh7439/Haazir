import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CaseTemplate } from '../../../api/schema';
import BottomSheet from '../../../components/ui/BottomSheet';
import Icon, { type IconName } from '../../../components/ui/Icon';
import OptionTile from '../../../components/ui/OptionTile';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';
import { FEATURED } from '../referralOptions';

const CASE_ICON: Record<string, IconName> = {
  snakebite_neuro: 'bug',
  snakebite_haemo: 'bug',
  head_injury: 'bandage',
  stemi: 'heartbeat',
  stroke: 'brain',
  preterm_newborn: 'baby',
  obstetric_bleed: 'drop',
};

/** The case, as big tiles one under the other: the commonest first, and every other one behind "Other cases". */
export default function CasePicker({
  templates,
  caseType,
  onPick,
}: {
  templates: CaseTemplate[];
  caseType: string;
  onPick: (template: CaseTemplate) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const featured = FEATURED.map((c) => templates.find((template) => template.case_type === c)).filter(
    (template): template is CaseTemplate => !!template,
  );
  const rest = templates.filter((template) => !FEATURED.includes(template.case_type));
  const picked = rest.find((template) => template.case_type === caseType);
  // A case chosen from the long list takes the place of the last tile, so the choice stays in view.
  const tiles = picked ? [...featured.slice(0, -1), picked] : featured;
  const items: Array<CaseTemplate | 'more'> = rest.length > 0 ? [...tiles, 'more'] : tiles;

  return (
    <View style={styles.wrap}>
      {items.map((item) =>
        item === 'more' ? (
          <OptionTile
            key="more"
            label={t('Other cases ({count})', { count: rest.length })}
            icon="more"
            layout="row"
            onPress={() => setSheet(true)}
          />
        ) : (
          <OptionTile
            key={item.case_type}
            testID={`case-${item.case_type}`}
            label={item.label}
            icon={CASE_ICON[item.case_type] ?? 'pulse'}
            layout="row"
            selected={item.case_type === caseType}
            onPress={() => onPick(item)}
          />
        ),
      )}
      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title={t('Choose a case')}>
        {rest.map((template) => (
          <Pressable
            key={template.case_type}
            accessibilityRole="button"
            onPress={() => {
              onPick(template);
              setSheet(false);
            }}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Text style={styles.itemLabel}>{template.label}</Text>
            {template.case_type === caseType ? <Icon name="check" size={theme.size.icon} color={theme.color.primary} /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.s },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.tint.hairline,
  },
  pressed: { opacity: 0.6 },
  itemLabel: { ...theme.type.body, color: theme.color.textPrimary, flex: 1 },
});
