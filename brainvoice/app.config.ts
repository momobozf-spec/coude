import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * BrainVoice Expo configuration.
 *
 * Native behaviour is configured here and in `plugins/` (config plugins) so that
 * `ios/` and `android/` stay generated (Continuous Native Generation, ADR-016).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'BrainVoice',
  slug: 'brainvoice',
  version: '0.1.0',
  scheme: 'brainvoice',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.brainvoice.app',
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSAlarmKitUsageDescription:
        'BrainVoice creates alarms and timers you ask for by voice, such as "wake me tomorrow at 6:30".',
      NSUserNotificationsUsageDescription:
        'BrainVoice uses notifications to deliver the reminders and timers you create.',
      UIBackgroundModes: [],
    },
    entitlements: {
      'com.apple.security.application-groups': ['group.com.brainvoice.app'],
    },
  },
  android: {
    package: 'com.brainvoice.app',
    adaptiveIcon: {
      backgroundColor: '#0B0B10',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.VIBRATE',
      'com.android.alarm.permission.SET_ALARM',
    ],
    blockedPermissions: ['android.permission.READ_CONTACTS'],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-localization',
    'expo-font',
    [
      'expo-sqlite',
      {
        enableFTS: true,
        useSQLCipher: false,
      },
    ],
    [
      'expo-calendar',
      {
        calendarPermission:
          'BrainVoice adds the events you ask for by voice to your calendar and reads your agenda for the Today view.',
        remindersPermission:
          'BrainVoice creates the reminders you ask for by voice in Apple Reminders.',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#7C5CFF',
        defaultChannel: 'reminders',
      },
    ],
    [
      'expo-speech-recognition',
      {
        microphonePermission:
          'BrainVoice listens only while you hold or tap the microphone, to transcribe what you say.',
        speechRecognitionPermission:
          'BrainVoice uses speech recognition to turn your voice into notes, tasks, reminders and events.',
        androidSpeechServicePackages: ['com.google.android.googlequicksearchbox'],
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'BrainVoice reads receipts and invoices you pick from your photos to record expenses and incoming invoices.',
        cameraPermission: 'BrainVoice photographs receipts and invoices to record expenses and incoming invoices.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '17.0' },
        android: { minSdkVersion: 26, compileSdkVersion: 36, targetSdkVersion: 36 },
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#0B0B10',
        dark: { backgroundColor: '#0B0B10' },
      },
    ],
    './plugins/withBrainVoiceIOS',
    './plugins/withBrainVoiceAndroid',
  ],
  extra: {
    // Non-secret runtime configuration only. Secrets never live here (see PRIVACY.md).
    aiProxyUrl: process.env.EXPO_PUBLIC_AI_PROXY_URL ?? '',
  },
});
