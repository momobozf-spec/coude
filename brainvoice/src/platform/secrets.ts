import * as SecureStore from 'expo-secure-store';

/**
 * Secrets live in the device keychain / keystore only (expo-secure-store).
 * They are never written to the SQLite database, logs or git (PRIVACY.md).
 */

const KEYS = {
  anthropicApiKey: 'bv.anthropic.apiKey',
  proxyToken: 'bv.proxy.token',
  alfredServerToken: 'bv.alfred.serverToken',
} as const;

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null): Promise<void> {
  if (value === null || value.trim() === '') {
    await SecureStore.deleteItemAsync(key, OPTIONS);
    return;
  }
  await SecureStore.setItemAsync(key, value.trim(), OPTIONS);
}

export const secrets = {
  getAnthropicApiKey: () => read(KEYS.anthropicApiKey),
  setAnthropicApiKey: (value: string | null) => write(KEYS.anthropicApiKey, value),
  getProxyToken: () => read(KEYS.proxyToken),
  setProxyToken: (value: string | null) => write(KEYS.proxyToken, value),
  getAlfredServerToken: () => read(KEYS.alfredServerToken),
  setAlfredServerToken: (value: string | null) => write(KEYS.alfredServerToken, value),
  isAvailable: () => SecureStore.isAvailableAsync(),
};
