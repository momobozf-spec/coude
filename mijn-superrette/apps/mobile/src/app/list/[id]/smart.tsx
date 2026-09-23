import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Card, Chip, Divider, ReceiptCard, Row, SectionHeader, Text, useTheme } from '@superrette/ui';
import { ErrorState, Loading, Screen } from '../../../components/Screen';
import { useI18n } from '../../../state/i18n';
import { useApi } from '../../../state/session';

/** Superrette Smart Basket: "Hoe doe ik deze boodschappen het goedkoopst?" */
export default function Smart(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { t, price } = useI18n();
  const { colors } = useTheme();
  const [maxStores, setMaxStores] = useState(2);
  const smart = useQuery({
    queryKey: ['smart', id, maxStores],
    queryFn: () => api.smartBasket(id, { maxStores }),
    retry: false,
  });
  const s = smart.data;
  return (
    <Screen title={t('smart.title')} back>
      <Text variant="heading" tone="muted" style={{ marginBottom: 12 }}>
        {t('smart.question')}
      </Text>
      <Text variant="caption" tone="muted">
        {t('smart.maxStores')}
      </Text>
      <Row gap={8} style={{ marginVertical: 10 }}>
        {[1, 2, 3].map((n) => (
          <Chip key={n} label={String(n)} selected={maxStores === n} onPress={() => setMaxStores(n)} />
        ))}
      </Row>
      {smart.isLoading ? <Loading /> : null}
      {smart.error ? <ErrorState error={smart.error} lockedMessage={t('smart.locked')} /> : null}
      {s ? (
        <>
          {s.singleStore.map((plan) => (
            <Card key={plan.retailers[0]?.id ?? 'none'} style={{ marginBottom: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Text variant="micro" tone="muted">
                    {t('smart.allAt', { retailer: plan.retailers[0]?.name ?? '—' }).toUpperCase()}
                  </Text>
                  <Text variant="caption" tone={plan.missingItemIds.length ? 'warning' : 'muted'}>
                    {t('basket.found', { found: plan.foundCount, total: plan.foundCount + plan.missingItemIds.length })}
                  </Text>
                </View>
                <Text variant="priceSmall">{price(plan.totalCents)}</Text>
              </Row>
            </Card>
          ))}
          {s.best && s.recommendCombining ? (
            <>
              <SectionHeader title={t('smart.combine')} />
              <ReceiptCard highlight>
                {s.best.retailers.map((r) => (
                  <Row key={r.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text variant="bodyStrong">{r.name}</Text>
                    <Text variant="priceSmall">{price(r.subtotalCents)}</Text>
                  </Row>
                ))}
                <Divider dashed />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="heading">{t('smart.total').toUpperCase()}</Text>
                  <Text variant="price">{price(s.best.totalCents)}</Text>
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                  <Text variant="heading" color={colors.success}>
                    {t('smart.youSave').toUpperCase()}
                  </Text>
                  <Text variant="price" color={colors.success}>
                    {price(s.savingsCents)}
                  </Text>
                </Row>
              </ReceiptCard>
            </>
          ) : (
            <Card style={{ marginTop: 12 }}>
              <Text>{t('smart.noBenefit')}</Text>
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  );
}
