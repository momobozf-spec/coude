import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { OrbitClient, type TokenStore, type Tokens } from '@orbit/api-client';

/**
 * De API-client voor mobiel.
 *
 * Tokens gaan in de SecureStore van het toestel (Keychain op iOS, Keystore op
 * Android) en niet in AsyncStorage: AsyncStorage is platte opslag die op een
 * geroot toestel gewoon te lezen is.
 */

const TOKEN_KEY = 'orbit.tokens';
const WORKSPACE_KEY = 'orbit.workspace';

export const secureTokenStore: TokenStore = {
  async get() {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Tokens;
    } catch {
      // Onleesbare opslag betekent uitloggen, niet crashen.
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      return null;
    }
  },
  async set(tokens) {
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

let currentWorkspaceId: string | null = null;

export async function loadWorkspaceId(): Promise<string | null> {
  currentWorkspaceId ??= await SecureStore.getItemAsync(WORKSPACE_KEY);
  return currentWorkspaceId;
}

export async function setWorkspaceId(workspaceId: string): Promise<void> {
  currentWorkspaceId = workspaceId;
  await SecureStore.setItemAsync(WORKSPACE_KEY, workspaceId);
}

export function apiBaseUrl(): string {
  const configured = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  return process.env.EXPO_PUBLIC_API_URL ?? configured ?? 'http://localhost:3000';
}

let client: OrbitClient | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

export function api(): OrbitClient {
  client ??= new OrbitClient({
    baseUrl: apiBaseUrl(),
    tokens: secureTokenStore,
    workspaceId: () => currentWorkspaceId,
    onUnauthenticated: () => onUnauthenticated?.(),
  });
  return client;
}
