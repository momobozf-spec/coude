import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Endpoints } from '../api/endpoints';
import { EAS_PROJECT_ID } from './config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

/**
 * Register this device for price-alert pushes (Expo push service).
 * Remote push requires a development/production build and an EAS project id;
 * in Expo Go or simulators this quietly does nothing.
 */
export async function registerForPush(api: Endpoints): Promise<'registered' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web' || !Device.isDevice || !EAS_PROJECT_ID) return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('price-alerts', { name: 'Prijsalarmen', importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
  await api.registerPushToken(token.data, Platform.OS === 'ios' ? 'ios' : 'android');
  return 'registered';
}

/** Open the related product when the user taps a price-alert notification. */
export function addNotificationTapListener(open: (variantId: string) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const variantId = response.notification.request.content.data?.variantId;
    if (typeof variantId === 'string') open(variantId);
  });
  return () => sub.remove();
}
