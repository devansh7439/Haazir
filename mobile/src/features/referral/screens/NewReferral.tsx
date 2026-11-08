import { StackActions, useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import type { Draft } from '../../../api/schema';
import { useSignedIn } from '../../../lib/session/SessionProvider';
import DraftsList from '../components/DraftsList';
import ReferralForm from '../components/ReferralForm';
import ReferrerPicker from '../components/ReferrerPicker';

/**
 * "Find a bed", opened from Home: one screen for the case and where to search from, with the nearest capable hospitals
 * listed as you go. Drafts from WhatsApp pre-fill it. After "Phone hospitals" the live board replaces this screen, so
 * going back from the board lands on Home rather than on a stale form. A coordinator chooses the doctor first, as on the
 * web form; a doctor refers as themselves.
 */
export default function NewReferral() {
  const navigation = useNavigation();
  const { boot } = useSignedIn();
  const [draft, setDraft] = useState<Draft | null>(null);
  const forOthers = boot.user.role !== 'doctor';
  // An admin starts on their own doctor; a coordinator has none.
  const [referrerId, setReferrerId] = useState(boot.referrer?.id ?? '');
  const referrer = forOthers ? (boot.referrers.find((r) => r.id === referrerId) ?? null) : boot.referrer;

  if (forOthers && !referrer && boot.referrers.length > 0) {
    return <ReferrerPicker referrers={boot.referrers} onPick={setReferrerId} onBack={() => navigation.goBack()} />;
  }
  return (
    <ReferralForm
      key={`${referrer?.id ?? 'none'}:${draft?.id ?? 'new'}`}
      boot={boot}
      referrer={referrer}
      draft={draft}
      header={draft ? undefined : <DraftsList onReview={setDraft} />}
      // Back from the form returns to the doctor choice, so a wrong pick can be changed.
      onBack={() => (forOthers && boot.referrers.length > 1 ? setReferrerId('') : navigation.goBack())}
      onCreated={(id) => navigation.dispatch(StackActions.replace('ReferralBoard', { id }))}
    />
  );
}
