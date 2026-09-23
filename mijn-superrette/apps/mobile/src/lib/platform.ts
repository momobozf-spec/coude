import { Alert, Platform, Share } from 'react-native';

/**
 * Cross-platform user interactions. React Native Web does not implement
 * Alert.alert, and Share needs the Web Share API, so the web gets browser
 * equivalents (confirm/alert, clipboard, file download).
 */

export const isWeb = Platform.OS === 'web';

export function notify(message: string): void {
  if (isWeb) globalThis.alert?.(message);
  else Alert.alert(message);
}

export function confirmAsync(
  title: string,
  message: string,
  labels: { confirm: string; cancel: string },
): Promise<boolean> {
  if (isWeb) return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: labels.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: labels.confirm, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Share text; on web without the Web Share API, copy it to the clipboard instead. */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  if (!isWeb) {
    await Share.share({ message });
    return 'shared';
  }
  const nav = globalThis.navigator as Navigator | undefined;
  try {
    if (nav?.share) {
      await nav.share({ text: message });
      return 'shared';
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(message);
      return 'copied';
    }
  } catch {
    // user cancelled or permission denied
  }
  return 'failed';
}

/** Offer JSON as a file download (web) or through the share sheet (native). */
export async function saveJson(filename: string, data: unknown): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  if (!isWeb) {
    await Share.share({ message: text, title: filename });
    return;
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
