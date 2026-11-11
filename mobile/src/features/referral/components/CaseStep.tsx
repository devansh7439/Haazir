import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CaseTemplate } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import Icon from '../../../components/ui/Icon';
import SearchField from '../../../components/ui/SearchField';
import { t } from '../../../lib/i18n';
import { matches } from '../../../lib/search';
import theme from '../../../theme';
import CasePicker from './CasePicker';
import FormBlock from './FormBlock';
import { NoteField } from './PatientSection';

/** Step 2 of the form: the case, found by tapping the list or by searching, and an optional note for the hospital. */
export default function CaseStep(props: {
  templates: CaseTemplate[];
  caseType: string;
  onPick: (template: CaseTemplate) => void;
  searching: boolean;
  query: string;
  onQuery: (query: string) => void;
  extra: string;
  onExtra: (extra: string) => void;
  noteErrors: string[];
  noteMax: number;
  warnings: string[];
}) {
  const searchText = props.query.trim();
  const found = searchText ? props.templates.filter((template) => matches(searchText, template.label)) : [];
  return (
    <>
      <FormBlock title={t('What is the case?')}>
        {props.searching ? (
          <SearchField value={props.query} onChangeText={props.onQuery} placeholder={t('Search cases, such as snake or stroke')} testID="case-search" />
        ) : null}
        {searchText ? (
          found.length > 0 ? (
            <View style={styles.found}>
              {found.map((template) => (
                <Pressable key={template.case_type} accessibilityRole="button" onPress={() => props.onPick(template)} style={styles.foundRow}>
                  <Text style={styles.foundLabel}>{template.label}</Text>
                  <Icon name="chevron-down" size={theme.size.icon} color={theme.color.textTertiary} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.hint}>{t('Nothing found for “{query}”', { query: searchText })}</Text>
          )
        ) : (
          <CasePicker templates={props.templates} caseType={props.caseType} onPick={props.onPick} />
        )}
      </FormBlock>
      <FormBlock title={t('Anything else?')} hint={t('Optional. Added to the note. No names or phone numbers.')}>
        <NoteField note={props.extra} onNote={props.onExtra} noteErrors={props.noteErrors} max={props.noteMax} />
        {props.warnings.map((warning) => (
          <Banner key={warning} tone="warning" title={warning} />
        ))}
      </FormBlock>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { ...theme.type.caption, color: theme.tint.muted, textAlign: 'center' },
  found: { borderRadius: theme.radius.tile, backgroundColor: theme.color.surface, borderWidth: 1.5, borderColor: theme.color.border },
  foundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: theme.space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.tint.hairline,
  },
  foundLabel: { ...theme.type.body, flex: 1, color: theme.color.textPrimary },
});
