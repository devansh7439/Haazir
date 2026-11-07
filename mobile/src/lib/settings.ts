import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** What a person can change in Account, grouped by the page it changes. Kept on this phone, never sent to the server. */
export interface Settings {
  /** Find a bed: how far from the start the search reaches. */
  radiusKm: number;
  /** Find a bed: start from this phone's position without asking each time. */
  useLocation: boolean;
  /** Referrals: show a referral's activity feed open. */
  showActivity: boolean;
  /** Hospitals: show Google's star ratings. */
  showRatings: boolean;
}

/** The settings of a phone that has never changed one. */
export const DEFAULT_SETTINGS: Settings = { radiusKm: 40, useLocation: false, showActivity: false, showRatings: true };

const KEY = 'haazir.settings';
let current: Settings = DEFAULT_SETTINGS;
const listeners = new Set<() => void>();

/** Reads the saved settings; anything missing or of the wrong kind falls back to its default. */
export function readSettings(raw: string | null): Settings {
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>) : {};
    return {
      radiusKm: typeof saved.radiusKm === 'number' && saved.radiusKm > 0 ? saved.radiusKm : DEFAULT_SETTINGS.radiusKm,
      useLocation: typeof saved.useLocation === 'boolean' ? saved.useLocation : DEFAULT_SETTINGS.useLocation,
      showActivity: typeof saved.showActivity === 'boolean' ? saved.showActivity : DEFAULT_SETTINGS.showActivity,
      showRatings: typeof saved.showRatings === 'boolean' ? saved.showRatings : DEFAULT_SETTINGS.showRatings,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Loads the saved settings when the app starts. */
export async function loadSettings(): Promise<void> {
  try {
    current = readSettings(await AsyncStorage.getItem(KEY));
    listeners.forEach((listener) => listener());
  } catch {
    // Not read: the defaults stay.
  }
}

/** Changes some settings; every page that shows them redraws, and the phone keeps them. */
export function updateSettings(change: Partial<Settings>): void {
  current = { ...current, ...change };
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

/** The settings as they are now, for code outside a screen. */
export const getSettings = (): Settings => current;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The settings, and a redraw when any of them changes. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
