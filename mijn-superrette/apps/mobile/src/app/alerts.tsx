import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card, EmptyState, IconButton, Row, Text, ToggleRow } from '@superrette/ui';
import { ErrorState, Loading, Screen } from '../components/Screen';
import { useI18n } from '../state/i18n';
import { useApi } from '../state/session';
import { Grid } from '../components/Grid';

export default function Alerts(): ReactNode {
  const api = useApi();
  const qc = useQueryClient();
  const { t, price } = useI18n();
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: api.alerts });
  const update = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateAlert(id, { enabled }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAlert(id),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
  return (
    <Screen title={t('alerts.title')} back>
      {alerts.isLoading ? <Loading /> : null}
      {alerts.error ? <ErrorState error={alerts.error} /> : null}
      {alerts.data?.length === 0 ? <EmptyState icon="bell" title={t('alerts.empty')} /> : null}
      <Grid max={2}>
        {alerts.data?.map((a) => (
          <Card key={a.id} style={{ marginBottom: 10 }} onPress={() => router.push(`/product/${a.variantId}`)}>
            <Row style={{ justifyContent: 'space-between' }} align="flex-start">
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{a.productName}</Text>
                <Text variant="caption" tone="muted">
                  {[
                    a.targetPriceCents != null ? t('alerts.below', { price: price(a.targetPriceCents) }) : null,
                    a.promotionOnly ? t('product.promo') : null,
                    a.retailerName ?? t('alerts.anyRetailer'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {a.currentBestPriceCents != null ? (
                  <Text variant="caption">{t('common.from', { price: price(a.currentBestPriceCents) })}</Text>
                ) : null}
              </View>
              <IconButton icon="trash" label={t('common.delete')} size={18} onPress={() => remove.mutate(a.id)} />
            </Row>
            <ToggleRow
              label={t('product.priceAlert')}
              value={a.enabled}
              onValueChange={(enabled) => update.mutate({ id: a.id, enabled })}
            />
          </Card>
        ))}
      </Grid>
    </Screen>
  );
}
