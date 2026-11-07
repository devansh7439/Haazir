import AsyncStorage from '@react-native-async-storage/async-storage';
import { setUiLanguage, type UiLanguage } from './index';

const KEY = 'haazir.language';

/** The language last chosen on this phone: shown on the sign-in screen and kept across sign-outs. */
export async function loadDeviceLanguage(): Promise<UiLanguage> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

async function saveDeviceLanguage(language: UiLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, language);
  } catch {
    // Not kept: the next start shows English.
  }
}

/** The switch: the screens change now and the phone remembers it. */
export function chooseLanguage(language: UiLanguage) {
  setUiLanguage(language);
  void saveDeviceLanguage(language);
}
