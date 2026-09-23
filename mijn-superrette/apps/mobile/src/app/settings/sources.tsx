import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Badge, Card, Divider, Row, Text } from '@superrette/ui';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi, useSession } from '../../state/session';

/** Transparency: where prices come from, per supermarket. */
export default function Sources(): ReactNode {
  const api = useApi();
  const { user } = useSession();
  const { t } = useI18n();
  const retailers = useQuery({ queryKey: ['retailers', user?.countryCode], queryFn: () => api.retailers(user?.countryCode ?? undefined) });
  return (
    <Screen title={t('profile.dataSources')} back>
      <Card style={{ marginBottom: 12, gap: 8 }}>
        <Text>{t('dataOrigin.CROWDSOURCED')}: Open Prices — Open Food Facts (ODbL).</Text>
        <Text variant="caption" tone="muted">
          {t('dataOrigin.DEVELOPMENT_SEED')}
        </Text>
      </Card>
      <Card>
        {retailers.data?.map((r, i) => (
          <SourceRow key={r.id} first={i === 0} name={r.name} status={r.dataSupport} />
        ))}
      </Card>
    </Screen>
  );
}

function SourceRow({ first, name, status }: { first: boolean; name: string; status: string }): ReactNode {
  return (
    <>
      {first ? null : <Divider />}
      <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
        <Text variant="bodyStrong">{name}</Text>
        <Badge label={status} tone={status === 'SUPPORTED' ? 'success' : status === 'EXPERIMENTAL' ? 'warning' : 'neutral'} />
      </Row>
    </>
  );
}
