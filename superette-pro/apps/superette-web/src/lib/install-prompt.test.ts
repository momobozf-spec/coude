import { describe, expect, it } from 'vitest';
import { detectInstallPlatform, INSTALL_DISMISSED_KEY, INSTALL_SNOOZE_MS, isDismissed, rememberDismissed } from './install-prompt';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data };
}

describe('detectInstallPlatform', () => {
  it('herkent een al geïnstalleerde app', () => {
    expect(detectInstallPlatform(ANDROID_CHROME, true)).toBe('installed');
    expect(detectInstallPlatform(IPHONE_SAFARI, true)).toBe('installed');
  });
  it('toont iOS-instructies alleen in Safari', () => {
    expect(detectInstallPlatform(IPHONE_SAFARI, false)).toBe('ios-safari');
    expect(detectInstallPlatform(IPHONE_CHROME, false)).toBe('ios-other');
  });
  it('laat Android aan het beforeinstallprompt-event over', () => {
    expect(detectInstallPlatform(ANDROID_CHROME, false)).toBe('other');
  });
});

describe('weggeklikt onthouden', () => {
  it('onthoudt "Niet nu" twee weken', () => {
    const storage = memoryStorage();
    expect(isDismissed(storage, 1_000)).toBe(false);
    expect(rememberDismissed(storage, 1_000)).toBe(true);
    expect(storage.data[INSTALL_DISMISSED_KEY]).toBe('1000');
    expect(isDismissed(storage, 1_000 + INSTALL_SNOOZE_MS - 1)).toBe(true);
    expect(isDismissed(storage, 1_000 + INSTALL_SNOOZE_MS + 1)).toBe(false);
  });
  it('werkt zonder of met geblokkeerde opslag', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(isDismissed(null)).toBe(false);
    expect(rememberDismissed(null)).toBe(false);
    expect(isDismissed(throwing)).toBe(false);
    expect(rememberDismissed(throwing)).toBe(false);
    expect(isDismissed(memoryStorage({ [INSTALL_DISMISSED_KEY]: 'onzin' }))).toBe(false);
  });
});
