import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Share } from 'react-native';
import { Button, Card, Text } from '@superrette/ui';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useApi, useSession } from '../../state/session';

/** GDPR rights in the app: export, clear history, delete account. */
export default function Privacy(): ReactNode {
  const api = useApi();
  const { signOut } = useSession();
  const { t } = useI18n();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <Screen title={t('profile.privacy')} back>
      <Card style={{ gap: 12 }}>
        <Button
          title={t('profile.exportData')}
          icon="share"
          variant="secondary"
          onPress={async () => {
            const data = await api.exportData();
            await Share.share({ message: JSON.stringify(data, null, 2), title: 'mijn-superrette-export.json' });
          }}
        />
        <Button
          title={t('profile.deleteHistory')}
          variant="secondary"
          onPress={async () => {
            await api.deleteSearchHistory();
            setMessage(t('profile.historyDeleted'));
          }}
        />
        {message ? <Text tone="success">{message}</Text> : null}
      </Card>
      <Card style={{ marginTop: 16, gap: 12 }}>
        <Text tone="muted">{t('profile.deleteAccountConfirm')}</Text>
        <Button
          title={t('profile.deleteAccount')}
          variant="danger"
          icon="trash"
          onPress={() =>
            Alert.alert(t('profile.deleteAccount'), t('profile.deleteAccountConfirm'), [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                  await api.deleteAccount();
                  await signOut();
                  router.replace('/welcome');
                },
              },
            ])
          }
        />
      </Card>
    </Screen>
  );
}
