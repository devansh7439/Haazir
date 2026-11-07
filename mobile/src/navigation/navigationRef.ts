import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Lets code outside a screen (a tapped notification) open a screen. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const RETRY_MS = 100;
const RETRIES = 30;

/** Opens a referral's live board. A notification that launched the app arrives before the navigator is ready, so it waits for it. */
export function openReferral(id: string, retriesLeft = RETRIES) {
  if (navigationRef.isReady()) {
    navigationRef.navigate('ReferralBoard', { id });
    return;
  }
  if (retriesLeft > 0) setTimeout(() => openReferral(id, retriesLeft - 1), RETRY_MS);
}
