import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { greetingKeyFor } from '@superrette/i18n';
import type { FavoriteDto } from '@superrette/validation';
import { Badge, Card, Icon, IconButton, PriceTag, Row, SectionHeader, Text, useTheme } from '@superrette/ui';
import { DataNotice } from '../../components/DataNotice';
import { PromotionCard } from '../../components/PromotionCard';
import { ErrorState, Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';

function FavoriteTile({ fav }: { fav: FavoriteDto }): ReactNode {
  const { t, price, unitPrice } = useI18n();
  const c = fav.product.cheapest;
  const insight = fav.insights[0];
  const insightLabel = insight
    ? { DISCOUNTED: t('home.insightDiscounted'), PRICE_DROP: t('home.insightPriceDrop'), HISTORICAL_LOW: t('home.insightHistoricLow'), ALERT_TRIGGERED: t('home.insightAlert') }[insight.kind]
    : null;
  return (
    <Card onPress={() => router.push(`/product/${fav.product.variantId}`)} style={{ marginBottom: 10 }}>
      <Row align="flex-start" gap={10}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {fav.product.name}
          </Text>
          {insightLabel ? <Badge label={insightLabel} tone={insight?.kind === 'DISCOUNTED' ? 'promo' : 'success'} /> : null}
          {c ? (
            <Text variant="caption" tone="muted">
              {c.retailerName}
            </Text>
          ) : null}
        </View>
        {c ? (
          <View style={{ alignItems: 'flex-end' }}>
            {insight?.previousPriceCents && insight.previousPriceCents > c.priceCents ? (
              <Text variant="caption" tone="muted">
                {price(insight.previousPriceCents)} → {price(c.priceCents)}
              </Text>
            ) : null}
            <PriceTag price={t('common.from', { price: price(c.priceCents) })} unit={unitPrice(c.unitPrice)} promo={c.isPromotion} />
            {insight?.discountPercent ? <Badge label={`-${Math.round(insight.discountPercent)}%`} tone="success" /> : null}
          </View>
        ) : null}
      </Row>
    </Card>
  );
}

export default function Home(): ReactNode {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const home = useQuery({ queryKey: ['home'], queryFn: api.home });
  const data = home.data;

  return (
    <Screen refreshing={home.isRefetching} onRefresh={() => void home.refetch()}>
      <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <Text variant="title">{t(greetingKeyFor(new Date()), { name: data?.displayName ?? '' })}</Text>
        <View>
          <IconButton icon="bell" label={t('notifications.title')} onPress={() => router.push('/notifications')} />
          {data?.unreadNotifications ? (
            <View style={{ position: 'absolute', right: 4, top: 4, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent }} />
          ) : null}
        </View>
      </Row>
      <Text variant="heading" tone="muted" style={{ marginTop: 4, marginBottom: 14 }}>
        {t('home.searchPrompt')}
      </Text>
      <Pressable
        accessibilityRole="search"
        onPress={() => router.push('/search')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 14 }}
      >
        <Icon name="search" size={20} color={colors.textMuted} />
        <Text tone="muted" style={{ flex: 1 }}>
          {t('home.searchPlaceholder')}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('scanner.title')} onPress={() => router.push('/scan')} hitSlop={10}>
          <Icon name="scan" size={22} />
        </Pressable>
      </Pressable>

      {home.isLoading ? <Loading /> : null}
      {home.error ? <ErrorState error={home.error} onRetry={() => void home.refetch()} /> : null}
      {data ? (
        <>
          <View style={{ marginTop: 16 }}>
            <DataNotice origins={data.dataOrigins} />
          </View>
          <SectionHeader title={t('home.favorites')} action={data.favorites.length ? t('common.seeAll') : undefined} onAction={() => router.push('/favorites')} />
          {data.favorites.length === 0 ? (
            <Text tone="muted">{t('home.noFavorites')}</Text>
          ) : (
            data.favorites.slice(0, 4).map((f) => <FavoriteTile key={f.product.variantId} fav={f} />)
          )}

          {data.promotionsForYou.length > 0 ? (
            <>
              <SectionHeader title={t('home.offersForYou')} action={t('common.seeAll')} onAction={() => router.push('/promotions')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {data.promotionsForYou.map((p) => (
                  <PromotionCard key={`${p.id}-${p.variantId}`} promo={p} compact />
                ))}
              </ScrollView>
            </>
          ) : null}

          {data.primaryList ? (
            <>
              <SectionHeader title={t('home.shoppingList')} />
              <Card onPress={() => router.push(`/list/${data.primaryList!.id}`)} style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
                <Text variant="heading" color={colors.onPrimary}>
                  {data.primaryList.name}
                </Text>
                <Text color={colors.onPrimary} style={{ opacity: 0.8 }}>
                  {t('home.listSummary', { count: data.primaryList.itemCount })}
                </Text>
                <Pressable onPress={() => router.push(`/list/${data.primaryList!.id}/compare`)} style={{ marginTop: 14 }}>
                  <Row gap={6}>
                    <Text variant="bodyStrong" color={colors.accent}>
                      {t('home.compareCta')}
                    </Text>
                    <Icon name="chevron-right" size={18} color={colors.accent} />
                  </Row>
                </Pressable>
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
