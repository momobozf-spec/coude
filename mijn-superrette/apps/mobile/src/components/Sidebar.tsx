import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Logo, palette, Text, type IconName } from '@superrette/ui';
import type { MessageKey } from '@superrette/i18n';
import { useI18n } from '../state/i18n';

const ITEMS: { path: string; icon: IconName; label: MessageKey; also?: string[] }[] = [
  { path: '/home', icon: 'home', label: 'nav.home', also: ['/favorites', '/notifications'] },
  { path: '/search', icon: 'search', label: 'nav.search', also: ['/product'] },
  { path: '/promotions', icon: 'tag', label: 'nav.promotions' },
  { path: '/lists', icon: 'list', label: 'nav.lists', also: ['/list'] },
  { path: '/profile', icon: 'user', label: 'nav.profile', also: ['/settings', '/alerts'] },
];

/**
 * Wide-screen navigation (web, tablets): a persistent sidebar that stays
 * visible on detail pages too, replacing the bottom tab bar.
 */
export function Sidebar(): ReactNode {
  const { t } = useI18n();
  const pathname = usePathname();
  const isActive = (item: (typeof ITEMS)[number]): boolean =>
    [item.path, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <View
      accessibilityRole="menu"
      style={{ width: 240, backgroundColor: palette.ink, paddingVertical: 24, paddingHorizontal: 14, gap: 4 }}
    >
      <Pressable
        accessibilityRole="link"
        onPress={() => router.navigate('/home')}
        style={{ paddingHorizontal: 8, marginBottom: 28 }}
      >
        <Logo size={36} inverted />
      </Pressable>
      {ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <Pressable
            key={item.path}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: active }}
            onPress={() => router.navigate(item.path as '/home')}
            style={({ hovered }: { hovered?: boolean }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 11,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: active ? 'rgba(240,138,75,0.18)' : hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
            })}
          >
            <Icon name={item.icon} size={20} color={active ? palette.apricot : palette.paper} />
            <Text variant="bodyStrong" color={active ? palette.apricot : palette.paper}>
              {t(item.label)}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/scan')}
        style={({ hovered }: { hovered?: boolean }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(250,246,239,0.25)',
          backgroundColor: hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        })}
      >
        <Icon name="scan" size={20} color={palette.paper} />
        <Text variant="bodyStrong" color={palette.paper}>
          {t('scanner.title')}
        </Text>
      </Pressable>
    </View>
  );
}
