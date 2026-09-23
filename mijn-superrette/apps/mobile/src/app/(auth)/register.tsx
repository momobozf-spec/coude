import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, TextField } from '@superrette/ui';
import { ApiError } from '../../api/client';
import { Screen } from '../../components/Screen';
import { useI18n } from '../../state/i18n';
import { useSession } from '../../state/session';

export default function Register(): ReactNode {
  const { t, locale } = useI18n();
  const { signUp } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await signUp({ email, password, displayName, locale });
      router.replace('/onboarding');
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'EMAIL_TAKEN' ? t('auth.emailTaken') : e instanceof ApiError && e.status === 400 ? t('auth.passwordHint') : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('auth.createAccount')} back>
      <View style={{ gap: 16 }}>
        <TextField label={t('auth.displayName')} value={displayName} onChangeText={setDisplayName} autoComplete="given-name" />
        <TextField label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextField label={`${t('auth.password')} · ${t('auth.passwordHint')}`} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={error} />
        <Button title={t('auth.createAccount')} onPress={submit} loading={busy} disabled={!email || password.length < 10 || !displayName} size="lg" />
      </View>
    </Screen>
  );
}
