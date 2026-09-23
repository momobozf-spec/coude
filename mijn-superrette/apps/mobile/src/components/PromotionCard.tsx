import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { PromotionDto } from '@superrette/validation';
import { Badge, Card, PriceTag, RetailerBadge, Row, Text } from '@superrette/ui';
import { useI18n } from '../state/i18n';

export function PromotionCard({ promo, compact }: { promo: PromotionDto; compact?: boolean }): ReactNode {
  const { t, price, date, promotion } = useI18n();
  return (
    <Card
      onPress={promo.variantId ? () => router.push(`/product/${promo.variantId}`) : undefined}
      style={compact ? { width: 240, marginRight: 10 } : { marginBottom: 10 }}
    >
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <RetailerBadge name={promo.retailer.name} color={promo.retailer.brandColor} size="sm" />
        <Badge label={promotion(promo.params)} tone="promo" icon="tag" />
      </Row>
      <Row align="flex-start" gap={10}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {promo.productName}
          </Text>
          {promo.loyaltyProgram ? (
            <Badge label={t('promotions.loyaltyOnly', { program: promo.loyaltyProgram })} tone="info" />
          ) : null}
          {promo.minimumQuantity > 1 ? (
            <Text variant="caption" tone="muted">
              {t('product.buyQuantity', { price: price(promo.promoPerItemCents), count: promo.minimumQuantity })}
            </Text>
          ) : null}
          {promo.endsAt ? (
            <Text variant="caption" tone="muted">
              {t('promotions.validUntil', { date: date(promo.endsAt) })}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <PriceTag price={price(promo.promoPerItemCents)} regular={price(promo.regularPriceCents)} promo />
          {promo.discountPercent > 0 ? <Badge label={`-${Math.round(promo.discountPercent)}%`} tone="success" /> : null}
        </View>
      </Row>
    </Card>
  );
}
