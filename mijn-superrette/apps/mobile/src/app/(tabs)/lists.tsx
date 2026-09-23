import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Chip, EmptyState, Icon, Row, SectionHeader, Text, TextField } from '@superrette/ui';
import { ErrorState, Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';
import { Grid } from '../../components/Grid';

const PRESETS = ['weekly', 'thisWeek', 'weekend', 'ramadan', 'family'] as const;

export default function Lists(): ReactNode {
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const lists = useQuery({ queryKey: ['lists'], queryFn: api.lists });
  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof PRESETS)[number] | 'custom'>('custom');
  const create = useMutation({
    mutationFn: () =>
      api.createList({ name: name.trim() || t(`lists.presets.${kind === 'custom' ? 'weekly' : kind}`), kind }),
    onSuccess: (list) => {
      setName('');
      void qc.invalidateQueries({ queryKey: ['lists'] });
      router.push(`/list/${list.id}`);
    },
  });

  return (
    <Screen title={t('lists.title')} refreshing={lists.isRefetching} onRefresh={() => void lists.refetch()}>
      {lists.isLoading ? <Loading /> : null}
      {lists.data?.length === 0 ? <EmptyState icon="list" title={t('lists.empty')} /> : null}
      <Grid>
        {lists.data?.map((l) => (
          <Card key={l.id} onPress={() => router.push(`/list/${l.id}`)} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{l.name}</Text>
                <Text variant="caption" tone="muted">
                  {t('lists.items', { count: l.itemCount })}
                  {l.checkedCount ? ` · ${l.checkedCount} ${t('lists.checked').toLowerCase()}` : ''}
                </Text>
              </View>
              {l.memberCount > 1 ? <Badge label={`${l.memberCount}`} tone="info" icon="user" /> : null}
              <Icon name="chevron-right" size={18} />
            </Row>
          </Card>
        ))}
      </Grid>

      <SectionHeader title={t('lists.newList')} />
      <Card>
        <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p}
              label={t(`lists.presets.${p}`)}
              selected={kind === p}
              onPress={() => {
                setKind(p);
                setName(t(`lists.presets.${p}`));
              }}
            />
          ))}
        </Row>
        <TextField
          placeholder={t('lists.listName')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setKind('custom');
          }}
        />
        <Button
          title={t('lists.newList')}
          icon="plus"
          onPress={() => create.mutate()}
          loading={create.isPending}
          style={{ marginTop: 12 }}
        />
        {create.error ? <ErrorState error={create.error} /> : null}
      </Card>
      {lists.error ? <ErrorState error={lists.error} onRetry={() => void lists.refetch()} /> : null}
    </Screen>
  );
}
