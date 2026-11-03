import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { api } from "../api/client";
import { storage } from "../session/storage";

// Push notifications: the server tells this phone about a first yes, a desk asking for the doctor, a held bed, or no
// acceptance, so the doctor hears even with the app closed. Written without a device or an Expo project to test
// against; the server half is tested (tests/push.test.ts). Try it on a real phone, in a development build.

export type PushStatus = "unknown" | "on" | "denied" | "unsupported" | "needs_project" | "error";

const TOKEN_KEY = "haazir.push";
const AnyOk = z.unknown();

// The browser preview has no push; on a phone the status is set when registration runs.
let status: PushStatus = Platform.OS === "web" ? "unsupported" : "unknown";
const listeners = new Set<() => void>();
const set = (next: PushStatus) => {
  status = next;
  listeners.forEach((l) => l());
};

/** Whether notifications are on for this phone, for the Account screen. */
export function usePushStatus(): PushStatus {
  return useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, () => status);
}

/** How a notification looks while the app is open: shown, with sound (a first yes should not be missed). */
export function configureNotificationHandler(): void {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Asks for permission, gets this phone's Expo push token and gives it to the server. Safe to call on every launch.
 * Needs a real device and an EAS project id (`eas init`); in Expo Go on Android and on simulators it reports why not.
 */
export async function registerPush(): Promise<PushStatus> {
  if (Platform.OS === "web" || !Device.isDevice) {
    set("unsupported");
    return status;
  }
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("referrals", {
        name: "Referral updates",
        // eslint-disable-next-line import/namespace -- re-exported with `export *`, which the import plugin cannot follow
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) {
      set("denied");
      return status;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      set("needs_project");
      return status;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api("/api/mobile/push-token", AnyOk, { body: { token, platform: Platform.OS === "ios" ? "ios" : "android" } });
    await storage.set(TOKEN_KEY, token);
    set("on");
  } catch {
    set("error");
  }
  return status;
}

/** Tells the server to stop sending to this phone (sign-out). Best effort. */
export async function unregisterPush(): Promise<void> {
  const token = await storage.get(TOKEN_KEY);
  if (!token) return;
  try {
    await api("/api/mobile/push-token", AnyOk, { method: "DELETE", body: { token } });
  } catch {
    // Offline or already signed out: the server drops tokens Expo reports as dead.
  }
  await storage.remove(TOKEN_KEY);
  set("unknown");
}
