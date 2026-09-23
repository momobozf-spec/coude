import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Row, Text, ToggleRow } from '@superrette/ui';
import { useI18n } from '../state/i18n';
import { useApi } from '../state/session';
import { Loading } from './Screen';

/** Retailer preferences are data-driven: whatever the API lists for the country. */
export function RetailerPicker({
  country,
  onSaved,
  cta,
}: {
  country: string;
  onSaved: () => void;
  cta: string;
}): ReactNode {
  const api = useApi();
  const { t } = useI18n();
  const retailers = useQuery({ queryKey: ['retailers', country], queryFn: () => api.retailers(country) });
  const mine = useQuery({ queryKey: ['my-retailers'], queryFn: api.myRetailers });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [cards, setCards] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mine.data) {
      setSelected(Object.fromEntries(mine.data.map((m) => [m.retailerId, true])));
      setCards(Object.fromEntries(mine.data.map((m) => [m.retailerId, m.hasLoyaltyCard])));
    }
  }, [mine.data]);

  const chosen = (retailers.data ?? []).filter((r) => selected[r.id]);
  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await api.setMyRetailers({
        retailers: chosen.map((r) => ({ retailerId: r.id, hasLoyaltyCard: Boolean(cards[r.id]) })),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  if (retailers.isLoading) return <Loading />;
  return (
    <View style={{ gap: 12 }}>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {retailers.data?.map((r) => (
          <Chip
            key={r.id}
            label={r.name}
            color={r.brandColor}
            selected={Boolean(selected[r.id])}
            onPress={() => setSelected((s) => ({ ...s, [r.id]: !s[r.id] }))}
          />
        ))}
      </Row>
      {chosen.some((r) => r.loyaltyProgramName) ? (
        <Card style={{ marginTop: 12 }}>
          <Text variant="heading">{t('onboarding.loyaltyTitle')}</Text>
          <Text variant="caption" tone="muted">
            {t('onboarding.loyaltyBody')}
          </Text>
          {chosen
            .filter((r) => r.loyaltyProgramName)
            .map((r) => (
              <ToggleRow
                key={r.id}
                label={`${r.name} · ${r.loyaltyProgramName}`}
                value={Boolean(cards[r.id])}
                onValueChange={(v) => setCards((c) => ({ ...c, [r.id]: v }))}
              />
            ))}
        </Card>
      ) : null}
      <Button
        title={cta}
        onPress={save}
        loading={busy}
        disabled={chosen.length === 0}
        size="lg"
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
