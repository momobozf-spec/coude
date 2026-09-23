import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Tokens, TokenStore } from './client';

const KEY = 'superrette.session';

/** Tokens live in the iOS Keychain / Android Keystore (web: localStorage for development). */
export const secureTokenStore: TokenStore = {
  async get() {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Tokens;
    } catch {
      return null;
    }
  },
  async set(tokens) {
    if (Platform.OS === 'web') {
      if (tokens) globalThis.localStorage?.setItem(KEY, JSON.stringify(tokens));
      else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(KEY);
  },
};
