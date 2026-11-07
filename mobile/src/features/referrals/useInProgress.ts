import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../../api/client';
import { ReferralListSchema, type ReferralListItem } from '../../api/schema';
import { newestInProgress } from './referrals.helper';

/** How often the newest referral still in progress is looked up while the app is open. */
const POLL_MS = 8000;

/**
 * The newest referral still in progress, or null: what the live bar shows on every tab. It is looked up every few seconds while the
 * app is in the foreground and not at all in the background, and a failed look-up keeps what was shown before.
 */
export function useInProgress(): ReferralListItem | null {
  const [current, setCurrent] = useState<ReferralListItem | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = async () => {
      if (AppState.currentState === 'active') {
        try {
          const { referrals } = await api('/api/referrals', ReferralListSchema);
          if (!stop) setCurrent(newestInProgress(referrals));
        } catch {
          // Offline for a moment: the bar keeps showing the last answer.
        }
      }
      if (!stop) timer = setTimeout(look, POLL_MS);
    };
    void look();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return current;
}
