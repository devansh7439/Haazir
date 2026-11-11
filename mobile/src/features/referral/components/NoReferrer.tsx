import Banner from '../../../components/ui/Banner';
import Screen from '../../../components/ui/Screen';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { t } from '../../../lib/i18n';

/** Shown instead of the form when the account has no referring doctor to place a referral for. */
export default function NoReferrer({ onBack }: { onBack: () => void }) {
  return (
    <Screen testID="new-referral" header={<ScreenHeader title={t('New referral')} onBack={onBack} />}>
      <Banner
        tone="warning"
        title={t('No referring doctor')}
        body={t('No referring doctor is set up for this account. Ask an admin to add one.')}
      />
    </Screen>
  );
}
