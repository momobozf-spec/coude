import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Button, Card, EmptyState, ListRow, Row, Stepper, Text } from '@superrette/ui';
import { ErrorState, Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';

export default function AddToList(): ReactNode {
  const { variantId, name } = useLocalSearchParams<{ variantId: string; name?: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: (listId: string) => api.addItem(listId, { title: name ?? '', preferredVariantId: variantId, quantity }),
    onSuccess: (_item, listId) => {
      void qc.invalidateQueries({ queryKey: ['list', listId] });
      void qc.invalidateQueries({ queryKey: ['lists'] });
      setAdded(lists.data?.find((l) => l.id === listId)?.name ?? '');
    },
  });

  return (
    <Screen title={t('product.addToList')} back edges={['top', 'bottom']}>
      <Text variant="heading" style={{ marginBottom: 12 }}>
        {name}
      </Text>
      <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <Text>{t('lists.quantity')}</Text>
        <Stepper value={quantity} onChange={setQuantity} />
      </Row>
      {added !== null ? (
        <Card style={{ marginBottom: 12 }}>
          <Text tone="success">{t('product.addedToList', { list: added })}</Text>
          <Button title={t('common.done')} onPress={() => router.back()} style={{ marginTop: 8 }} />
        </Card>
      ) : null}
      {lists.isLoading ? <Loading /> : null}
      {lists.data?.length === 0 ? <EmptyState title={t('lists.empty')} action={<Button title={t('lists.newList')} onPress={() => router.push('/lists')} />} /> : null}
      <Card>
        {lists.data?.map((l) => (
          <ListRow key={l.id} title={l.name} subtitle={t('lists.items', { count: l.itemCount })} onPress={() => add.mutate(l.id)} />
        ))}
      </Card>
      {add.error ? <ErrorState error={add.error} /> : null}
    </Screen>
  );
}
