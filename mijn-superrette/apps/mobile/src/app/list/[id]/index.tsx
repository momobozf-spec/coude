import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, View } from 'react-native';
import type { ShoppingListDetailDto, ShoppingListItemDto } from '@superrette/validation';
import { Badge, Button, Card, Divider, Icon, IconButton, Row, SearchField, Text, useTheme } from '@superrette/ui';
import { ApiError } from '../../../api/client';
import { ErrorState, Loading, Screen } from '../../../components/Screen';
import { useListRealtime } from '../../../lib/realtime';
import { useI18n } from '../../../state/i18n';
import { useApi } from '../../../state/session';

function ItemRow({ item, onToggle, onDelete }: { item: ShoppingListItemDto; onToggle: () => void; onDelete: () => void }): ReactNode {
  const { colors } = useTheme();
  return (
    <Row style={{ paddingVertical: 10 }} gap={12}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        onPress={onToggle}
        style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: item.checked ? colors.success : colors.border, backgroundColor: item.checked ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}
      >
        {item.checked ? <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3} /> : null}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => item.preferredVariantId && router.push(`/product/${item.preferredVariantId}`)}>
        <Text variant="bodyStrong" tone={item.checked ? 'muted' : 'default'} strike={item.checked}>
          {item.quantity > 1 ? `${item.quantity}× ` : ''}
          {item.title}
        </Text>
        {item.preferredVariantName && item.preferredVariantName !== item.title ? (
          <Text variant="caption" tone="muted">
            {item.preferredVariantName}
          </Text>
        ) : null}
      </Pressable>
      <IconButton icon="trash" label="delete" size={18} color={colors.textMuted} onPress={onDelete} />
    </Row>
  );
}

export default function ListScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { colors } = useTheme();
  const key = ['list', id];
  const list = useQuery({ queryKey: key, queryFn: () => api.list(id) });
  const { lastActivity } = useListRealtime(id);
  const [text, setText] = useState('');

  const add = useMutation({
    mutationFn: (title: string) => api.addItem(id, { title }),
    onSuccess: (item) => {
      setText('');
      qc.setQueryData<ShoppingListDetailDto>(key, (prev) => (prev && !prev.items.some((i) => i.id === item.id) ? { ...prev, items: [...prev.items, item] } : prev));
    },
  });

  const toggle = useMutation({
    mutationFn: (item: ShoppingListItemDto) => api.updateItem(id, item.id, { checked: !item.checked, version: item.version }),
    onMutate: (item) => qc.setQueryData<ShoppingListDetailDto>(key, (prev) => (prev ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)) } : prev)),
    onSuccess: (updated) => qc.setQueryData<ShoppingListDetailDto>(key, (prev) => (prev ? { ...prev, items: prev.items.map((i) => (i.id === updated.id ? updated : i)) } : prev)),
    onError: (error) => {
      // Conflict: someone changed the item meanwhile; show their version.
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') Alert.alert(t('lists.conflict'));
      void qc.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => api.deleteItem(id, itemId),
    onMutate: (itemId) => qc.setQueryData<ShoppingListDetailDto>(key, (prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev)),
  });

  const l = list.data;
  const open = l?.items.filter((i) => !i.checked) ?? [];
  const done = l?.items.filter((i) => i.checked) ?? [];
  const activityText = lastActivity
    ? {
        ITEM_ADDED: t('lists.activityAdded', { name: lastActivity.userDisplayName ?? '?', item: String(lastActivity.payload.item ?? '') }),
        ITEM_CHECKED: t('lists.activityChecked', { name: lastActivity.userDisplayName ?? '?', item: String(lastActivity.payload.item ?? '') }),
        ITEM_UNCHECKED: t('lists.activityUnchecked', { name: lastActivity.userDisplayName ?? '?', item: String(lastActivity.payload.item ?? '') }),
        ITEM_REMOVED: t('lists.activityRemoved', { name: lastActivity.userDisplayName ?? '?', item: String(lastActivity.payload.item ?? '') }),
        MEMBER_JOINED: t('lists.activityJoined', { name: lastActivity.userDisplayName ?? '?' }),
      }[lastActivity.type]
    : null;

  return (
    <Screen title={l?.name} back right={l && l.role === 'OWNER' ? <IconButton icon="share" label={t('lists.share')} onPress={() => router.push(`/list/${id}/share`)} /> : null} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      {list.isLoading ? <Loading /> : null}
      {list.error ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}
      {l ? (
        <>
          {l.members.length > 1 ? (
            <Row gap={6} style={{ marginBottom: 10, flexWrap: 'wrap' }}>
              {l.members.map((m) => (
                <Badge key={m.userId} label={m.displayName} tone="info" icon="user" />
              ))}
            </Row>
          ) : null}
          {activityText ? (
            <View style={{ backgroundColor: colors.infoSoft, borderRadius: 10, padding: 10, marginBottom: 10 }}>
              <Text variant="caption" tone="info">
                {activityText}
              </Text>
            </View>
          ) : null}
          {l.role !== 'VIEWER' ? (
            <SearchField value={text} onChangeText={setText} placeholder={t('lists.addItemPlaceholder')} onSubmit={() => text.trim() && add.mutate(text.trim())} />
          ) : null}
          <Card style={{ marginTop: 12 }}>
            {l.items.length === 0 ? <Text tone="muted">{t('lists.empty')}</Text> : null}
            {open.map((i, idx) => (
              <View key={i.id}>
                {idx > 0 ? <Divider /> : null}
                <ItemRow item={i} onToggle={() => toggle.mutate(i)} onDelete={() => remove.mutate(i.id)} />
              </View>
            ))}
            {done.length > 0 ? (
              <>
                <Text variant="micro" tone="muted" style={{ marginTop: 12 }}>
                  {t('lists.checked').toUpperCase()}
                </Text>
                {done.map((i) => (
                  <ItemRow key={i.id} item={i} onToggle={() => toggle.mutate(i)} onDelete={() => remove.mutate(i.id)} />
                ))}
              </>
            ) : null}
          </Card>
          {l.items.length > 0 ? (
            <View style={{ gap: 10, marginTop: 20 }}>
              <Button title={t('lists.compare')} icon="basket" size="lg" onPress={() => router.push(`/list/${id}/compare`)} />
              <Button title={t('lists.smartBasket')} icon="sparkle" variant="accent" size="lg" onPress={() => router.push(`/list/${id}/smart`)} />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
