import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Card, EmptyState, Row, Text, useTheme } from '@superrette/ui';
import { ErrorState, Loading, Screen } from '../components/Screen';
import { useI18n } from '../state/i18n';
import { useApi } from '../state/session';

export default function Notifications(): ReactNode {
  const api = useApi();
  const qc = useQueryClient();
  const { t, date } = useI18n();
  const { colors } = useTheme();
  const list = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const read = useMutation({ mutationFn: (id: string) => api.readNotification(id), onSettled: () => void qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: api.readAllNotifications, onSettled: () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); void qc.invalidateQueries({ queryKey: ['home'] }); } });
  return (
    <Screen title={t('notifications.title')} back right={list.data?.unread ? <Button title={t('notifications.markAllRead')} size="sm" variant="ghost" onPress={() => readAll.mutate()} /> : null}>
      {list.isLoading ? <Loading /> : null}
      {list.error ? <ErrorState error={list.error} /> : null}
      {list.data?.items.length === 0 ? <EmptyState icon="bell" title={t('notifications.empty')} /> : null}
      {list.data?.items.map((n) => (
        <Card
          key={n.id}
          style={{ marginBottom: 10, borderLeftWidth: n.readAt ? 1 : 4, borderLeftColor: n.readAt ? colors.border : colors.accent }}
          onPress={() => {
            if (!n.readAt) read.mutate(n.id);
            if (typeof n.data.variantId === 'string') router.push(`/product/${n.data.variantId}`);
          }}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="bodyStrong">{n.title}</Text>
            <Text variant="caption" tone="muted">
              {date(n.createdAt, 'short')}
            </Text>
          </Row>
          <View style={{ marginTop: 4 }}>
            <Text>{n.body}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
