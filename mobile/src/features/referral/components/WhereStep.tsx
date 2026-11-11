import Banner from '../../../components/ui/Banner';
import SelectField from '../../../components/ui/SelectField';
import SwitchRow from '../../../components/ui/SwitchRow';
import { t } from '../../../lib/i18n';
import { updateSettings } from '../../../lib/settings';
import type { useOrigin } from '../hooks/useOrigin';
import { RADII_KM } from '../referralOptions';
import FormBlock from './FormBlock';

/** Step 4 of the form: where the search starts (this phone or the centre) and how far it reaches. */
export default function WhereStep({
  location,
  radius,
  onRadius,
}: {
  location: ReturnType<typeof useOrigin>;
  radius: number;
  onRadius: (km: number) => void;
}) {
  const here = !!location.origin || location.busy;
  return (
    <FormBlock title={t('Where from?')}>
      <SwitchRow
        title={t('Use my current location')}
        subtitle={here && !location.busy ? t('Using this phone’s position.') : t('Otherwise the search starts from your centre.')}
        value={here}
        disabled={location.busy}
        onValueChange={(on) => (on ? void location.enable() : location.disable())}
      />
      {location.error ? <Banner tone="warning" title={location.error} /> : null}
      <SelectField
        label={t('Search distance')}
        value={String(radius)}
        options={RADII_KM.map((km) => ({ value: String(km), label: t('{km} km', { km }) }))}
        onChange={(v) => {
          onRadius(Number(v));
          updateSettings({ radiusKm: Number(v) });
        }}
      />
    </FormBlock>
  );
}
