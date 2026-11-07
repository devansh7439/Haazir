import { StackActions, useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import type { Draft } from '../../../api/schema';
import { useSignedIn } from '../../../lib/session/SessionProvider';
import DraftsList from '../components/DraftsList';
import ReferralForm from '../components/ReferralForm';

/**
 * "Find a bed", opened from Home: one screen for the case and where to search from, with the nearest capable hospitals
 * listed as you go. Drafts from WhatsApp pre-fill it. After "Phone hospitals" the live board replaces this screen, so
 * going back from the board lands on Home rather than on a stale form.
 */
export default function NewReferral() {
  const navigation = useNavigation();
  const { boot } = useSignedIn();
  const [draft, setDraft] = useState<Draft | null>(null);
  return (
    <ReferralForm
      key={draft?.id ?? 'new'}
      boot={boot}
      draft={draft}
      header={draft ? undefined : <DraftsList onReview={setDraft} />}
      onBack={() => navigation.goBack()}
      onCreated={(id) => navigation.dispatch(StackActions.replace('ReferralBoard', { id }))}
    />
  );
}
