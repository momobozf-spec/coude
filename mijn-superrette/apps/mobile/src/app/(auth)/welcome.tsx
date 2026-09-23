import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Logo, palette, Text } from '@superrette/ui';
import { useI18n } from '../../state/i18n';

export default function Welcome(): ReactNode {
  const { t } = useI18n();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.ink }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ marginTop: 32 }}>
          <Logo size={48} inverted />
        </View>
        <View style={{ gap: 14 }}>
          <Text variant="display" color={palette.paper}>
            {t('app.tagline')}
          </Text>
          <Text color={palette.apricotSoft}>{t('auth.welcomeBody')}</Text>
        </View>
        <View style={{ gap: 12, marginBottom: 12 }}>
          <Button title={t('auth.createAccount')} variant="accent" size="lg" onPress={() => router.push('/register')} />
          <Button title={t('auth.haveAccount')} variant="secondary" size="lg" onPress={() => router.push('/login')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
