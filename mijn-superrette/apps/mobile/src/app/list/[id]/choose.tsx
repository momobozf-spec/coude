import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Button, Card, ConfidenceMeter, Divider, Row, Text, useTheme } from '@superrette/ui';
import { ErrorState, Loading, Screen } from '../../../components/Screen';
import { useI18n } from '../../../state/i18n';
import { useApi } from '../../../state/session';

/** "Wijzig product": pick another product for one list item at one supermarket. */
export default function ChooseProduct(): ReactNode {
  const { id, itemId, retailerId } = useLocalSearchParams<{ id: string; itemId: string; retailerId: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const { t, price, unitPrice } = useI18n();
  const { colors } = useTheme();
  const compare = useQuery({ queryKey: ['compare', id], queryFn: () => api.compare(id) });
  const basket = compare.data?.retailers.find((r) => r.retailer.id === retailerId);
  const line = basket?.lines.find((l) => l.itemId === itemId);

  const select = useMutation({
    mutationFn: (retailerProductId: string | null) => api.selectProduct(id, itemId, retailerId, retailerProductId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['compare', id] });
      router.back();
    },
  });

  return (
    <Screen narrow title={t('basket.chooseProduct')} back edges={['top', 'bottom']}>
      {compare.isLoading ? <Loading /> : null}
      {line && basket ? (
        <>
          <Text variant="heading">{line.title}</Text>
          <Text tone="muted" style={{ marginBottom: 12 }}>
            {basket.retailer.name}
          </Text>
          {line.selected ? (
            <Card style={{ marginBottom: 12, borderColor: colors.success }}>
              <Text variant="micro" tone="success">
                {t('basket.currentSelection').toUpperCase()}
              </Text>
              <Text variant="bodyStrong">{line.selected.name}</Text>
              <Text variant="priceSmall">{price(line.selected.totalCents)}</Text>
            </Card>
          ) : (
            <Badge label={t('basket.missing')} tone="danger" />
          )}
          <Card>
            {line.alternatives.map((a, i) => {
              const selected = a.retailerProductId === line.selected?.retailerProductId;
              return (
                <Pressable
                  key={a.retailerProductId}
                  onPress={() => select.mutate(a.retailerProductId)}
                  disabled={selected}
                >
                  {i > 0 ? <Divider /> : null}
                  <Row style={{ justifyContent: 'space-between', paddingVertical: 8, opacity: selected ? 0.5 : 1 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="bodyStrong">{a.name}</Text>
                      <Row gap={8}>
                        <Badge
                          label={
                            a.matchType === 'EXACT'
                              ? t('basket.exact')
                              : a.matchType === 'EQUIVALENT'
                                ? t('basket.equivalent')
                                : t('basket.generic')
                          }
                          tone={a.matchType === 'EXACT' ? 'success' : 'info'}
                        />
                        <ConfidenceMeter
                          value={a.confidence}
                          label={t('basket.confidence', { percent: Math.round(a.confidence * 100) })}
                        />
                      </Row>
                      {a.promotionLabel ? (
                        <Text variant="caption" tone="accent">
                          {a.promotionLabel}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="priceSmall">{price(a.totalCents)}</Text>
                      <Text variant="caption" tone="muted">
                        {unitPrice(a.unitPrice)}
                      </Text>
                    </View>
                  </Row>
                </Pressable>
              );
            })}
          </Card>
          {line.status === 'USER_SELECTED' ? (
            <Button
              title={t('common.cancel')}
              variant="ghost"
              style={{ marginTop: 12 }}
              onPress={() => select.mutate(null)}
            />
          ) : null}
          {select.error ? <ErrorState error={select.error} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
