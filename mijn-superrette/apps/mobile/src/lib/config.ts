import Constants from 'expo-constants';

/** Public configuration only. No API credentials ever ship in the app. */
// EXPO_PUBLIC_* variables are inlined at build time; app.config extra is the fallback.
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:3000').replace(/\/$/, '');

export const EAS_PROJECT_ID: string | undefined =
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
