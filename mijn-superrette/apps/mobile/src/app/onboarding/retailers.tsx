import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@superrette/ui';
import { RetailerPicker } from '../../components/RetailerPicker';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi, useSession } from '../../state/session';

export default function OnboardingRetailers(): ReactNode {
  const { t } = useI18n();
  const api = useApi();
  const { refreshUser, user } = useSession();
  const params = useLocalSearchParams<{ country?: string }>();
  const country = params.country ?? user?.countryCode ?? 'BE';
  return (
    <Screen narrow back>
      <View style={{ gap: 8, marginBottom: 16 }}>
        <Text variant="display">{t('onboarding.retailersTitle')}</Text>
        <Text tone="muted">{t('onboarding.retailersBody')}</Text>
      </View>
      <RetailerPicker
        country={country}
        cta={t('onboarding.finish')}
        onSaved={async () => {
          await api.updateMe({ onboardingCompleted: true });
          await refreshUser();
          router.replace('/home');
        }}
      />
    </Screen>
  );
}
