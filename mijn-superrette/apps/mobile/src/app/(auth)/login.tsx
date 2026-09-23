import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Text, TextField } from '@superrette/ui';
import { ApiError } from '../../api/client';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useSession } from '../../state/session';

export default function Login(): ReactNode {
  const { t } = useI18n();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await signIn({ email, password });
      router.replace('/');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t('auth.invalidCredentials') : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen narrow title={t('auth.login')} back>
      <View style={{ gap: 16 }}>
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={error}
        />
        <Button title={t('auth.login')} onPress={submit} loading={busy} disabled={!email || !password} size="lg" />
        <Text tone="muted" align="center" onPress={() => router.replace('/register')}>
          {t('auth.noAccount')} {t('auth.createAccount')}
        </Text>
      </View>
    </Screen>
  );
}
