import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Logo, LogoMark, palette, Text } from '@superrette/ui';
import { useLayout } from '../../lib/layout';
import { useI18n } from '../../state/i18n';

export default function Welcome(): ReactNode {
  const { t } = useI18n();
  const { isWide } = useLayout();
  const actions = (
    <View style={{ gap: 12, width: '100%', maxWidth: 420 }}>
      <Button title={t('auth.createAccount')} variant="accent" size="lg" onPress={() => router.push('/register')} />
      <Button title={t('auth.haveAccount')} variant="secondary" size="lg" onPress={() => router.push('/login')} />
    </View>
  );
  const pitch = (
    <View style={{ gap: 14, maxWidth: 620 }}>
      <Text variant="display" color={palette.paper} style={isWide ? { fontSize: 44, lineHeight: 52 } : undefined}>
        {t('app.tagline')}
      </Text>
      <Text color={palette.apricotSoft} style={isWide ? { fontSize: 18, lineHeight: 27 } : undefined}>
        {t('auth.welcomeBody')}
      </Text>
    </View>
  );

  if (isWide) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.ink }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 48 }}>
          <Logo size={48} inverted />
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 64 }}>
            <View style={{ flex: 3, gap: 36 }}>
              {pitch}
              {actions}
            </View>
            <View style={{ flex: 2, alignItems: 'center' }}>
              <LogoMark size={260} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.ink }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ marginTop: 32 }}>
          <Logo size={48} inverted />
        </View>
        {pitch}
        <View style={{ marginBottom: 12 }}>{actions}</View>
      </View>
    </SafeAreaView>
  );
}
