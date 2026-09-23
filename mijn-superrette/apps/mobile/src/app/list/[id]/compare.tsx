import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { BasketLineDto, RetailerBasketDto } from '@superrette/validation';
import {
  Badge,
  ConfidenceMeter,
  Divider,
  Icon,
  ReceiptCard,
  RetailerBadge,
  Row,
  Text,
  useTheme,
  type BadgeTone,
} from '@superrette/ui';
import { DataNotice } from '../../../components/DataNotice';
import { ErrorState, Loading, Screen } from '../../../components/Screen';
import { useI18n } from '../../../state/i18n';
import { useApi } from '../../../state/session';

function statusBadge(line: BasketLineDto, t: ReturnType<typeof useI18n>['t']): { label: string; tone: BadgeTone } {
  switch (line.status) {
    case 'EXACT':
      return { label: t('basket.exact'), tone: 'success' };
    case 'EQUIVALENT':
      return { label: t('basket.equivalent'), tone: 'info' };
    case 'GENERIC':
      return { label: t('basket.generic'), tone: 'neutral' };
    case 'USER_SELECTED':
      return { label: t('basket.userSelected'), tone: 'promo' };
    default:
      return { label: t('basket.missing'), tone: 'danger' };
  }
}

function RetailerReceipt({
  basket,
  listId,
  cheapest,
}: {
  basket: RetailerBasketDto;
  listId: string;
  cheapest: boolean;
}): ReactNode {
  const { t, price } = useI18n();
  const { colors } = useTheme();
  const [open, setOpen] = useState(cheapest);
  return (
    <ReceiptCard highlight={cheapest} style={{ marginBottom: 14 }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Row style={{ justifyContent: 'space-between' }}>
          <RetailerBadge name={basket.retailer.name} color={basket.retailer.brandColor} />
          <Text variant="price" color={cheapest ? colors.success : colors.text}>
            {price(basket.totalCents)}
          </Text>
        </Row>
        <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8 }}>
          <Badge
            label={t('basket.found', { found: basket.foundCount, total: basket.itemCount })}
            tone={basket.isComplete ? 'success' : 'warning'}
          />
          {cheapest ? <Badge label={t('basket.cheapestComplete')} tone="success" icon="check" /> : null}
        </Row>
        {basket.savingsCents > 0 ? (
          <Text variant="caption" tone="accent" style={{ marginTop: 6 }}>
            {t('basket.savings', { amount: price(basket.savingsCents) })}
          </Text>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ marginTop: 10 }}>
          {basket.lines.map((line) => {
            const badge = statusBadge(line, t);
            return (
              <View key={line.itemId}>
                <Divider dashed />
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/list/[id]/choose',
                      params: { id: listId, itemId: line.itemId, retailerId: basket.retailer.id },
                    })
                  }
                  style={{ paddingVertical: 6 }}
                >
                  <Row style={{ justifyContent: 'space-between' }} align="flex-start">
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text variant="bodyStrong">
                        {line.quantity > 1 ? `${line.quantity}× ` : ''}
                        {line.title}
                      </Text>
                      {line.selected ? (
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {line.selected.name}
                          {line.selected.promotionLabel ? ` · ${line.selected.promotionLabel}` : ''}
                        </Text>
                      ) : null}
                      <Row gap={8}>
                        <Badge label={badge.label} tone={badge.tone} />
                        {line.confidence != null && line.status !== 'EXACT' ? (
                          <ConfidenceMeter
                            value={line.confidence}
                            label={t('basket.confidence', { percent: Math.round(line.confidence * 100) })}
                          />
                        ) : null}
                      </Row>
                    </View>
                    <Row gap={4}>
                      <Text variant="priceSmall" tone={line.selected ? 'default' : 'danger'}>
                        {line.selected ? price(line.selected.totalCents) : '—'}
                      </Text>
                      <Icon name="chevron-right" size={16} color={colors.textMuted} />
                    </Row>
                  </Row>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </ReceiptCard>
  );
}

/** "Vergelijk mijn lijst": every supermarket's receipt, missing items never hidden. */
export default function Compare(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { t } = useI18n();
  const compare = useQuery({ queryKey: ['compare', id], queryFn: () => api.compare(id) });
  const data = compare.data;
  return (
    <Screen title={t('basket.title')} back refreshing={compare.isRefetching} onRefresh={() => void compare.refetch()}>
      {compare.isLoading ? <Loading /> : null}
      {compare.error ? (
        <ErrorState error={compare.error} onRetry={() => void compare.refetch()} lockedMessage={t('basket.locked')} />
      ) : null}
      {data ? (
        <>
          <DataNotice origins={data.dataOrigins} />
          {data.retailerLimit !== null ? (
            <Text variant="caption" tone="muted" style={{ marginBottom: 10 }}>
              {t('basket.locked')}
            </Text>
          ) : null}
          {data.retailers.map((r) => (
            <RetailerReceipt
              key={r.retailer.id}
              basket={r}
              listId={id}
              cheapest={r.retailer.id === data.cheapestCompleteRetailerId}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
