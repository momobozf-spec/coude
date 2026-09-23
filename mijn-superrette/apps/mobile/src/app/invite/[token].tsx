import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Button, Card, EmptyState, Text } from '@superrette/ui';
import { ErrorState, Loading, Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi, useSession } from '../../state/session';

/** Deep link: mijnsuperrette://invite/<token> or https://…/invite/<token>. */
export default function AcceptInvite(): ReactNode {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status } = useSession();
  const api = useApi();
  const qc = useQueryClient();
  const { t } = useI18n();
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.previewInvite(token),
    enabled: status === 'signed-in',
  });
  const accept = useMutation({
    mutationFn: () => api.acceptInvite(token),
    onSuccess: (list) => {
      void qc.invalidateQueries({ queryKey: ['lists'] });
      router.replace(`/list/${list.id}`);
    },
  });
  if (status === 'signed-out') return <Redirect href="/welcome" />;
  return (
    <Screen narrow title={t('sharing.accept')} back>
      {preview.isLoading ? <Loading /> : null}
      {preview.data && preview.data.valid ? (
        <Card>
          <Text variant="heading">{preview.data.listName}</Text>
          <Text tone="muted">{preview.data.invitedBy}</Text>
          <Button
            title={t('sharing.accept')}
            size="lg"
            style={{ marginTop: 16 }}
            loading={accept.isPending}
            onPress={() => accept.mutate()}
          />
        </Card>
      ) : null}
      {preview.data && !preview.data.valid ? <EmptyState icon="info" title={t('sharing.expired')} /> : null}
      {preview.error || accept.error ? <ErrorState error={preview.error ?? accept.error} /> : null}
    </Screen>
  );
}
