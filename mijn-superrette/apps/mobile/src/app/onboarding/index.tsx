import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Locale } from '@superrette/domain';
import { Button, Chip, Row, Text } from '@superrette/ui';
import { Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi, useSession } from '../../state/session';

const LANGUAGE_NAMES: Record<Locale, string> = { nl: 'Nederlands', fr: 'Français', en: 'English' };

export default function OnboardingCountry(): ReactNode {
  const api = useApi();
  const { refreshUser } = useSession();
  const { t, locale, setLocale } = useI18n();
  const countries = useQuery({ queryKey: ['countries'], queryFn: api.countries });
  const [country, setCountry] = useState<string>('BE');
  const [busy, setBusy] = useState(false);
  const selected = countries.data?.find((c) => c.code === country);

  const next = async (): Promise<void> => {
    setBusy(true);
    try {
      await api.updateMe({ countryCode: country as 'BE' | 'NL', locale });
      await refreshUser();
      router.push({ pathname: '/onboarding/retailers', params: { country } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 12, marginTop: 24 }}>
        <Text variant="display">{t('onboarding.countryTitle')}</Text>
        <Text tone="muted">{t('onboarding.countryBody')}</Text>
        {countries.isLoading ? <Loading /> : null}
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {countries.data?.map((c) => <Chip key={c.code} label={c.name[locale]} selected={c.code === country} onPress={() => setCountry(c.code)} />)}
        </Row>
        <Text variant="heading" style={{ marginTop: 24 }}>
          {t('onboarding.languageTitle')}
        </Text>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {(selected?.languages ?? ['nl', 'fr', 'en']).map((l) => (
            <Chip key={l} label={LANGUAGE_NAMES[l]} selected={l === locale} onPress={() => setLocale(l)} />
          ))}
        </Row>
        <Button title={t('common.next')} onPress={next} loading={busy} size="lg" style={{ marginTop: 32 }} />
      </View>
    </Screen>
  );
}
