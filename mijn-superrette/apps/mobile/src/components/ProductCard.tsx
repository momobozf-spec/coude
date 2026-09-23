import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { ProductSummaryDto } from '@superrette/validation';
import { Badge, Card, PriceTag, Row, Text } from '@superrette/ui';
import { useI18n } from '../state/i18n';

export function ProductCard({ product, footer }: { product: ProductSummaryDto; footer?: ReactNode }): ReactNode {
  const { t, price, unitPrice } = useI18n();
  const c = product.cheapest;
  return (
    <Card onPress={() => router.push(`/product/${product.variantId}`)} style={{ marginBottom: 10 }}>
      <Row align="flex-start" gap={12}>
        <View style={{ flex: 1, gap: 4 }}>
          {product.brand ? (
            <Text variant="micro" tone="muted">
              {product.brand.toUpperCase()}
            </Text>
          ) : null}
          <Text variant="bodyStrong" numberOfLines={2}>
            {product.name}
          </Text>
          {c ? (
            <Row gap={6}>
              <Text variant="caption" tone="muted">
                {c.retailerName}
              </Text>
              {c.isPromotion ? <Badge label={t('product.promo')} tone="promo" /> : null}
            </Row>
          ) : (
            <Text variant="caption" tone="muted">
              {t('product.noPrices')}
            </Text>
          )}
          {product.retailerCount > 1 ? (
            <Text variant="caption" tone="muted">
              {t('search.retailerCount', { count: product.retailerCount })}
            </Text>
          ) : null}
        </View>
        {c ? (
          <PriceTag
            price={product.retailerCount > 1 ? t('common.from', { price: price(c.priceCents) }) : price(c.priceCents)}
            regular={c.isPromotion ? price(c.regularPriceCents) : null}
            unit={unitPrice(c.unitPrice)}
            promo={c.isPromotion}
          />
        ) : null}
      </Row>
      {footer}
    </Card>
  );
}
