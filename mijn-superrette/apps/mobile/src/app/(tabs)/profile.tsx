import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Badge, Button, Card, Divider, ListRow, Logo, Text } from '@superrette/ui';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi, useSession } from '../../state/session';

export default function Profile(): ReactNode {
  const api = useApi();
  const { user, signOut } = useSession();
  const { t } = useI18n();
  const ents = useQuery({ queryKey: ['entitlements'], queryFn: api.entitlements });
  const isPlus = ents.data?.plans.includes('plus');
  return (
    <Screen narrow title={t('profile.title')}>
      <Card style={{ marginBottom: 16 }}>
        <Text variant="heading">{user?.displayName}</Text>
        <Text tone="muted">{user?.email}</Text>
        <Badge label={isPlus ? t('plans.plus') : t('plans.free')} tone={isPlus ? 'promo' : 'neutral'} />
      </Card>
      <Card>
        <ListRow title={t('profile.retailers')} onPress={() => router.push('/settings/retailers')} />
        <Divider />
        <ListRow title={t('alerts.title')} onPress={() => router.push('/alerts')} />
        <Divider />
        <ListRow title={t('notifications.title')} onPress={() => router.push('/notifications')} />
        <Divider />
        <ListRow title={t('home.favorites')} onPress={() => router.push('/favorites')} />
        <Divider />
        <ListRow title={t('profile.language')} onPress={() => router.push('/settings/language')} />
        <Divider />
        <ListRow title={t('profile.subscription')} onPress={() => router.push('/settings/plan')} />
        <Divider />
        <ListRow title={t('profile.privacy')} onPress={() => router.push('/settings/privacy')} />
        <Divider />
        <ListRow title={t('profile.dataSources')} onPress={() => router.push('/settings/sources')} />
      </Card>
      <Button
        title={t('auth.logout')}
        variant="ghost"
        style={{ marginTop: 24 }}
        onPress={async () => {
          await signOut();
          router.replace('/welcome');
        }}
      />
      <Logo size={28} />
    </Screen>
  );
}
