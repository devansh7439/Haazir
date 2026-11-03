import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The token goes in the platform's secure store (Keychain, Keystore). On the web build, which is only a preview,
// SecureStore doesn't exist, so localStorage stands in. Every call tolerates storage being unavailable.

const web = Platform.OS === "web";

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return web ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (web) globalThis.localStorage?.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      // Not persisted: the person signs in again next time.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (web) globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      // Nothing to remove.
    }
  },
};
