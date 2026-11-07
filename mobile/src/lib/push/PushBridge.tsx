import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { openReferral } from '../../navigation/navigationRef';
import { registerPush } from './push';

/**
 * Rendered once while signed in, on phones only: registers for push, and opens the referral a tapped notification is
 * about (also when the tap is what launched the app).
 */
export function PushBridge() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    void registerPush();
  }, []);
  useEffect(() => {
    const id = last?.notification.request.content.data?.referralId;
    if (typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) openReferral(id);
  }, [last]);
  return null;
}
