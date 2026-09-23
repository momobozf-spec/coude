import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Badge, Card, Icon, Row, Text, useTheme } from '@superrette/ui';
import { Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi } from '../../state/session';

const FEATURE_LABELS: Record<string, string> = {
  search: 'search.title',
  basic_comparison: 'product.prices',
  shopping_lists: 'lists.title',
  basket_comparison: 'basket.title',
  advanced_basket_comparison: 'basket.title',
  price_alerts: 'alerts.title',
  price_history: 'product.history',
  smart_basket: 'smart.title',
  shared_lists: 'sharing.title',
  advanced_filters: 'search.filters',
};

/** Plans come from the server: entitlements are configurable without an app release. */
export default function Plan(): ReactNode {
  const api = useApi();
  const { t } = useI18n();
  const { colors } = useTheme();
  const plans = useQuery({ queryKey: ['plans'], queryFn: api.plans });
  const mine = useQuery({ queryKey: ['entitlements'], queryFn: api.entitlements });
  return (
    <Screen title={t('profile.subscription')} back>
      {plans.isLoading ? <Loading /> : null}
      {plans.data?.map((p) => (
        <Card key={p.key} style={{ marginBottom: 12, borderColor: p.key === 'plus' ? colors.accent : colors.border }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="heading">{p.key === 'plus' ? t('plans.plus') : t('plans.free')}</Text>
            {mine.data?.plans.includes(p.key) ? <Badge label={t('plans.current')} tone="success" /> : null}
          </Row>
          {p.entitlements.map((e) => (
            <Row key={e.key} gap={8} style={{ marginTop: 6 }}>
              <Icon
                name={e.enabled ? 'check' : 'close'}
                size={16}
                color={e.enabled ? colors.success : colors.textMuted}
              />
              <Text tone={e.enabled ? 'default' : 'muted'}>
                {t((FEATURE_LABELS[e.key] ?? 'app.name') as Parameters<typeof t>[0])}
                {e.enabled && e.limit !== null ? ` (max ${e.limit})` : ''}
              </Text>
            </Row>
          ))}
        </Card>
      ))}
      <Text variant="caption" tone="muted">
        {t('plans.storeNotAvailable')}
      </Text>
    </Screen>
  );
}
