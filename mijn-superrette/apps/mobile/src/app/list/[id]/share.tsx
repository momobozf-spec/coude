import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Button, Card, Divider, ListRow, Text } from '@superrette/ui';
import { ErrorState, Screen } from '../../../components/Screen';
import { shareText } from '../../../lib/platform';
import { useI18n } from '../../../state/i18n';
import { useApi } from '../../../state/session';

export default function ShareList(): ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { t } = useI18n();
  const list = useQuery({ queryKey: ['list', id], queryFn: () => api.list(id) });
  const [link, setLink] = useState<{ url: string; copied: boolean } | null>(null);
  const invite = useMutation({
    mutationFn: (role: 'EDITOR' | 'VIEWER') => api.createInvite(id, role),
    onSuccess: async (inv) => {
      const result = await shareText(t('sharing.inviteMessage', { list: list.data?.name ?? '', link: inv.url }));
      // Always show the link too, so it can be copied manually if sharing failed.
      setLink({ url: inv.url, copied: result === 'copied' });
    },
  });
  return (
    <Screen narrow title={t('sharing.title')} back>
      <Text tone="muted" style={{ marginBottom: 16 }}>
        {t('sharing.body')}
      </Text>
      <Button
        title={`${t('sharing.createInvite')} · ${t('sharing.roleEditor')}`}
        icon="share"
        size="lg"
        loading={invite.isPending}
        onPress={() => invite.mutate('EDITOR')}
      />
      <Button
        title={`${t('sharing.createInvite')} · ${t('sharing.roleViewer')}`}
        variant="secondary"
        style={{ marginTop: 10 }}
        onPress={() => invite.mutate('VIEWER')}
      />
      {invite.error ? <ErrorState error={invite.error} /> : null}
      {link ? (
        <Card style={{ marginTop: 12, gap: 4 }}>
          {link.copied ? <Text tone="success">{t('common.copied')}</Text> : null}
          <Text selectable variant="caption">
            {link.url}
          </Text>
        </Card>
      ) : null}
      <Card style={{ marginTop: 20 }}>
        <Text variant="micro" tone="muted">
          {t('lists.members').toUpperCase()}
        </Text>
        {list.data?.members.map((m, i) => (
          <ListRowWithDivider
            key={m.userId}
            first={i === 0}
            title={m.displayName}
            subtitle={
              m.role === 'OWNER' ? 'Owner' : m.role === 'EDITOR' ? t('sharing.roleEditor') : t('sharing.roleViewer')
            }
          />
        ))}
      </Card>
    </Screen>
  );
}

function ListRowWithDivider({
  first,
  title,
  subtitle,
}: {
  first: boolean;
  title: string;
  subtitle: string;
}): ReactNode {
  return (
    <>
      {first ? null : <Divider />}
      <ListRow title={title} subtitle={subtitle} />
    </>
  );
}
