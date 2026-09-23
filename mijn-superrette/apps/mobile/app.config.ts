import type { ExpoConfig } from 'expo/config';

/**
 * No secrets live here: the mobile app only knows the public API URL.
 * EAS project id is injected via EAS_PROJECT_ID for push notifications.
 */
const config: ExpoConfig = {
  name: 'Mijn Superrette',
  slug: 'mijn-superrette',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'mijnsuperrette',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  backgroundColor: '#FAF6EF',
  ios: {
    bundleIdentifier: 'app.mijnsuperrette',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'Mijn Superrette gebruikt je camera om streepjescodes van producten te scannen.',
    },
  },
  android: {
    package: 'app.mijnsuperrette',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#17323A' },
    permissions: ['CAMERA'],
    predictiveBackGestureEnabled: false,
  },
  web: { output: 'single', favicon: './assets/icon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    [
      'expo-camera',
      {
        cameraPermission: 'Mijn Superrette gebruikt je camera om streepjescodes van producten te scannen.',
        recordAudioAndroid: false,
      },
    ],
    ['expo-notifications', { color: '#F08A4B', defaultChannel: 'price-alerts' }],
    ['expo-splash-screen', { backgroundColor: '#17323A', image: './assets/splash.png', imageWidth: 160 }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
};

export default config;
