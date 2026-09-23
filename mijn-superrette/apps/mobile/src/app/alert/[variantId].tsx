import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { parsePriceToCents } from '@superrette/shared';
import { Button, Chip, Row, Text, TextField, ToggleRow } from '@superrette/ui';
import { ErrorState, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';

/** "Laat mij weten wanneer … onder €2 komt" / "… in promotie staat". */
export default function CreateAlert(): ReactNode {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const api = useApi();
  const qc = useQueryClient();
  const { t, price } = useI18n();
  const product = useQuery({ queryKey: ['product', variantId, 'mine'], queryFn: () => api.product(variantId) });
  const [target, setTarget] = useState('');
  const [promotionOnly, setPromotionOnly] = useState(false);
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const targetCents = target ? parsePriceToCents(target) : null;

  const create = useMutation({
    mutationFn: () => api.createAlert({ variantId, targetPriceCents: targetCents, promotionOnly, retailerId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alerts'] });
      void qc.invalidateQueries({ queryKey: ['product', variantId] });
      router.back();
    },
  });

  const current = product.data?.cheapest?.priceCents;
  return (
    <Screen narrow title={t('alerts.create')} back edges={['top', 'bottom']}>
      <Text variant="heading">{product.data?.name}</Text>
      {current != null ? (
        <Text tone="muted" style={{ marginBottom: 16 }}>
          {t('common.from', { price: price(current) })}
        </Text>
      ) : null}
      <View style={{ gap: 12 }}>
        <TextField
          label={t('alerts.targetPrice')}
          placeholder="2,00"
          keyboardType="decimal-pad"
          value={target}
          onChangeText={setTarget}
        />
        {targetCents != null ? <Text tone="info">{t('alerts.below', { price: price(targetCents) })}</Text> : null}
        <ToggleRow label={t('alerts.promotionOnly')} value={promotionOnly} onValueChange={setPromotionOnly} />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Chip label={t('alerts.anyRetailer')} selected={retailerId === null} onPress={() => setRetailerId(null)} />
          {product.data?.offers.map((o) => (
            <Chip
              key={o.retailer.id}
              label={o.retailer.name}
              color={o.retailer.brandColor}
              selected={retailerId === o.retailer.id}
              onPress={() => setRetailerId(o.retailer.id)}
            />
          ))}
        </Row>
        <Button
          title={t('alerts.create')}
          icon="bell"
          size="lg"
          disabled={targetCents == null && !promotionOnly}
          loading={create.isPending}
          onPress={() => create.mutate()}
        />
        {create.error ? <ErrorState error={create.error} lockedMessage={t('alerts.limitReached')} /> : null}
      </View>
    </Screen>
  );
}
