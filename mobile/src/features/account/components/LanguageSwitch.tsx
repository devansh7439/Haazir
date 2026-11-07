import SegmentedControl from '../../../components/ui/SegmentedControl';
import { type UiLanguage, useUiLanguage } from '../../../lib/i18n';
import { chooseLanguage } from '../../../lib/i18n/deviceLanguage';

// Each language is named in its own script, so a person can find theirs whichever one the screens are in.
const LANGUAGES: { value: UiLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
];

/** English or Hindi. Choosing redraws every screen in that language, and the phone remembers it. */
export default function LanguageSwitch() {
  return <SegmentedControl value={useUiLanguage()} segments={LANGUAGES} onChange={chooseLanguage} />;
}
