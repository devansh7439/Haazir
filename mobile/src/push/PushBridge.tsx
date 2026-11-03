import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { registerPush } from "./push";

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
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) router.push(`/referral/${id}`);
  }, [last]);
  return null;
}
