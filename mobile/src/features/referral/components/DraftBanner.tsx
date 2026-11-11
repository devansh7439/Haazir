import type { Draft } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import { t } from '../../../lib/i18n';

/** Tells the doctor a WhatsApp message filled this form, what it understood, and that every field still needs a check. */
export default function DraftBanner({ draft }: { draft: Draft }) {
  const { matched, note_dropped: noteDropped } = draft.parsed;
  const understood = matched.length ? `${t('Understood: {cases}.', { cases: matched.join(', ') })} ` : '';
  const dropped = noteDropped ? ` ${t('The note was left out because it may contain a name or number.')}` : '';
  return <Banner tone="info" title={t('Filled from your WhatsApp')} body={`${understood}${t('Check every field before you start.')}${dropped}`} />;
}
