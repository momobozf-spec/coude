import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { OfferDto, ProductDetailDto } from '@superrette/validation';
import {
  Badge,
  Button,
  Card,
  Chip,
  ConfidenceMeter,
  Divider,
  Icon,
  PriceChart,
  ReceiptCard,
  RetailerBadge,
  Row,
  SectionHeader,
  Text,
  useTheme,
} from '@superrette/ui';
import { ApiError } from '../../api/client';
import { DataNotice } from '../../components/DataNotice';
import { ErrorState, Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';

function OfferLine({ offer }: { offer: OfferDto }): ReactNode {
  const { t, price, unitPrice } = useI18n();
  const { colors } = useTheme();
  const loyalty = offer.missedPromotions.find((m) => m.reason === 'LOYALTY_CARD_REQUIRED' && m.potentialPriceCents != null);
  const quantityDeal = offer.missedPromotions.find((m) => m.reason === 'NO_BENEFIT_AT_QUANTITY');
  return (
    <View style={{ paddingVertical: 10 }}>
      <Row style={{ justifyContent: 'space-between' }} align="flex-start">
        <View style={{ gap: 4, flex: 1 }}>
          <Row gap={6}>
            <RetailerBadge name={offer.retailer.name} color={offer.retailer.brandColor} size="sm" />
            {offer.isPromotion ? <Badge label={t('product.promo')} tone="promo" /> : null}
            {offer.isCheapest ? <Badge label={t('product.cheapest')} tone="success" icon="check" /> : null}
          </Row>
          {offer.appliedPromotion ? (
            <Text variant="caption" tone="accent">
              {offer.appliedPromotion.label}
            </Text>
          ) : null}
          {quantityDeal ? (
            <Text variant="caption" tone="info">
              {quantityDeal.label} · {t('promotions.minQuantity', { count: quantityDeal.minimumQuantity })}
            </Text>
          ) : null}
          {loyalty ? (
            <Text variant="caption" tone="info">
              {t('product.missedLoyalty', { program: loyalty.label, price: price(loyalty.potentialPriceCents!) })}
            </Text>
          ) : null}
          {!offer.isAvailable ? (
            <Text variant="caption" tone="danger">
              {t('product.notAvailable')}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="priceSmall" color={offer.isCheapest ? colors.success : offer.isPromotion ? colors.accent : colors.text}>
            {price(offer.priceCents)}
          </Text>
          {offer.isPromotion ? (
            <Text variant="caption" tone="muted" strike>
              {price(offer.regularPriceCents)}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {unitPrice(offer.unitPrice)}
          </Text>
        </View>
      </Row>
    </View>
  );
}

function History({ variantId }: { variantId: string }): ReactNode {
  const api = useApi();
  const { t, price, date } = useI18n();
  const { colors } = useTheme();
  const history = useQuery({ queryKey: ['history', variantId], queryFn: () => api.history(variantId), retry: false });
  if (history.isLoading) return <Loading />;
  if (history.error instanceof ApiError && history.error.code === 'ENTITLEMENT_REQUIRED') {
    return (
      <Card>
        <Row gap={10}>
          <Icon name="sparkle" color={colors.accent} />
          <Text style={{ flex: 1 }}>{t('product.historyLocked')}</Text>
        </Row>
      </Card>
    );
  }
  const h = history.data;
  if (!h || h.observationCount === 0) return <Text tone="muted">{t('product.historyNone')}</Text>;
  // At most three lines stay readable: keep the retailers that are cheapest now.
  const lastCents = (points: { cents: number }[]): number => points[points.length - 1]?.cents ?? Number.POSITIVE_INFINITY;
  const series = [...h.series].sort((a, b) => lastCents(a.points) - lastCents(b.points)).slice(0, 3).map((s, i) => ({
    label: s.retailerName,
    color: [colors.success, colors.primary, colors.accent][i % 3]!,
    points: s.points.map((p) => ({ x: new Date(p.date).getTime(), y: p.cents, highlight: p.isPromo })),
  }));
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        {[
          [t('product.historyCurrent'), h.current?.cents],
          [t('product.historyLowest'), h.lowest?.cents],
          [t('product.historyAverage'), h.averageCents],
        ].map(([label, cents]) => (
          <View key={String(label)}>
            <Text variant="caption" tone="muted">
              {label}
            </Text>
            <Text variant="priceSmall">{typeof cents === 'number' ? price(cents) : '—'}</Text>
          </View>
        ))}
      </Row>
      {h.isHistoricalLow ? <Badge label={t('home.insightHistoricLow')} tone="success" /> : null}
      <PriceChart series={series} formatY={(y) => price(Math.round(y))} />
      <Row gap={10} style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {series.map((s) => (
          <Row key={s.label} gap={4}>
            <View style={{ width: 10, height: 3, backgroundColor: s.color }} />
            <Text variant="caption" tone="muted">
              {s.label}
            </Text>
          </Row>
        ))}
      </Row>
      {!h.isComplete ? (
        <Text variant="caption" tone="warning" style={{ marginTop: 8 }}>
          {t('product.historyIncomplete')}
        </Text>
      ) : null}
      {h.lowest ? (
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {t('product.historyLowest')}: {price(h.lowest.cents)} · {date(h.lowest.observedAt)}
        </Text>
      ) : null}
    </Card>
  );
}

export default function ProductScreen(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const { t, price, unitPrice, date } = useI18n();
  const { colors } = useTheme();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const product = useQuery({ queryKey: ['product', id, scope], queryFn: () => api.product(id, scope) });
  const equivalents = useQuery({ queryKey: ['equivalents', id], queryFn: () => api.equivalents(id) });

  const favorite = useMutation({
    mutationFn: (on: boolean) => (on ? api.addFavorite(id) : api.removeFavorite(id)),
    onMutate: (on) => qc.setQueryData<ProductDetailDto>(['product', id, scope], (p) => (p ? { ...p, isFavorite: on } : p)),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['home'] });
      void qc.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const p = product.data;
  return (
    <Screen back>
      {product.isLoading ? <Loading /> : null}
      {product.error ? <ErrorState error={product.error} onRetry={() => void product.refetch()} /> : null}
      {p ? (
        <>
          {p.brand ? (
            <Text variant="micro" tone="muted">
              {p.brand.toUpperCase()}
            </Text>
          ) : null}
          <Text variant="title">{p.name}</Text>
          <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
            {p.sizeLabel ? <Badge label={p.sizeLabel} /> : null}
            {p.category ? <Badge label={p.category.name} tone="info" /> : null}
            {p.dietary.map((d) => (
              <Badge key={d} label={t(`dietary.${d}`)} tone="success" />
            ))}
          </Row>

          <Row gap={8} style={{ marginVertical: 16, flexWrap: 'wrap' }}>
            <Button
              title={p.isFavorite ? t('product.favorited') : t('product.favorite')}
              icon={p.isFavorite ? 'heart-filled' : 'heart'}
              variant={p.isFavorite ? 'accent' : 'secondary'}
              size="sm"
              onPress={() => favorite.mutate(!p.isFavorite)}
            />
            <Button title={t('product.addToList')} icon="plus" variant="secondary" size="sm" onPress={() => router.push(`/add-to-list/${p.variantId}?name=${encodeURIComponent(p.name)}`)} />
            <Button title={t('product.priceAlert')} icon="bell" variant="secondary" size="sm" onPress={() => router.push(`/alert/${p.variantId}`)} />
          </Row>

          <DataNotice origins={p.dataOrigins} />

          {p.cheapest ? (
            <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft, marginBottom: 8 }}>
              <Text variant="micro" tone="success">
                {t('product.cheapest').toUpperCase()}
              </Text>
              <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                <Text variant="heading">{p.cheapest.retailer.name}</Text>
                <Text variant="price" tone="success">
                  {price(p.cheapest.priceCents)}
                </Text>
              </Row>
              {p.cheapest.unitPrice ? (
                <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <Text variant="caption" tone="muted">
                    {t('product.unitPrice', { unit: p.cheapest.unitPrice.per === 'piece' ? t('units.piece', { count: 1 }) : t(`units.${p.cheapest.unitPrice.per}`) })}
                  </Text>
                  <Text variant="bodyStrong">{unitPrice(p.cheapest.unitPrice)}</Text>
                </Row>
              ) : null}
            </Card>
          ) : (
            <Text tone="muted">{t('product.noPrices')}</Text>
          )}

          <SectionHeader title={t('product.prices')} action={scope === 'mine' ? t('common.seeAll') : undefined} onAction={() => setScope('all')} />
          {p.offers.length > 0 ? (
            <ReceiptCard>
              {p.offers.map((o, i) => (
                <View key={o.retailerProductId}>
                  {i > 0 ? <Divider dashed /> : null}
                  <OfferLine offer={o} />
                </View>
              ))}
              {p.offers[0] ? (
                <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>
                  {t('product.lastUpdated', { date: date(p.offers[0].observedAt) })}
                </Text>
              ) : null}
            </ReceiptCard>
          ) : null}

          {p.otherSizes.length > 0 ? (
            <>
              <SectionHeader title={t('product.otherSizes')} />
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {p.otherSizes.map((s) => (
                  <Chip key={s.variantId} label={s.sizeLabel ?? s.name} onPress={() => router.push(`/product/${s.variantId}`)} />
                ))}
              </Row>
            </>
          ) : null}

          {equivalents.data && equivalents.data.length > 0 ? (
            <>
              <SectionHeader title={t('product.equivalents')} />
              <Card>
                {equivalents.data.slice(0, 6).map((e, i) => (
                  <Pressable key={e.variantId} onPress={() => router.push(`/product/${e.variantId}`)}>
                    {i > 0 ? <Divider /> : null}
                    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text variant="bodyStrong" numberOfLines={2}>
                          {e.name}
                        </Text>
                        <ConfidenceMeter value={e.confidence} label={t('basket.confidence', { percent: Math.round(e.confidence * 100) })} />
                      </View>
                      <Text variant="priceSmall">{e.cheapestPriceCents != null ? price(e.cheapestPriceCents) : '—'}</Text>
                    </Row>
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}

          <SectionHeader title={t('product.history')} />
          <History variantId={p.variantId} />
        </>
      ) : null}
    </Screen>
  );
}
