import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@orbit/api-client';
import { Button } from '@/components/ui';
import { useSession } from '@/lib/session';
import { spacing, typography, useTheme } from '@/theme';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mailadres of wachtwoord klopt niet.',
  EMAIL_IN_USE: 'Er bestaat al een account met dit e-mailadres.',
  CONFLICT: 'Er bestaat al een account met dit e-mailadres.',
  RATE_LIMITED: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.',
  VALIDATION_FAILED: 'Controleer de ingevulde gegevens.',
};

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useSession();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (isRegister) await signUp(email.trim(), password, name.trim());
      else await signIn(email.trim(), password);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : null;
      setError(
        (code ? MESSAGES[code] : null) ??
          (caught instanceof ApiError ? caught.message : 'Geen verbinding met de server.'),
      );
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    typography.body,
    styles.input,
    {
      color: theme.color.text.primary,
      backgroundColor: theme.color.bg.surface,
      borderColor: theme.color.border.default,
    },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: theme.color.bg.canvas }}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[16] }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.mark, { backgroundColor: theme.color.accent.default }]}>
          <Text style={{ color: theme.color.text.onAccent, fontSize: 22, fontWeight: '700' }}>O</Text>
        </View>

        <Text style={[typography.title, { color: theme.color.text.primary, textAlign: 'center' }]}>
          {isRegister ? 'Account aanmaken' : 'Welkom terug'}
        </Text>
        <Text
          style={[
            typography.callout,
            { color: theme.color.text.tertiary, textAlign: 'center', marginBottom: spacing[6] },
          ]}
        >
          Ideeën, taken en notities op één plek.
        </Text>

        {isRegister ? (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Naam"
            placeholderTextColor={theme.color.text.disabled}
            autoComplete="name"
            style={inputStyle}
          />
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-mailadres"
          placeholderTextColor={theme.color.text.disabled}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={inputStyle}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={isRegister ? 'Wachtwoord (minimaal 10 tekens)' : 'Wachtwoord'}
          placeholderTextColor={theme.color.text.disabled}
          secureTextEntry
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          style={inputStyle}
        />

        {error ? (
          <Text style={[typography.caption, { color: theme.color.status.danger }]}>{error}</Text>
        ) : null}

        <Button
          label={isRegister ? 'Account aanmaken' : 'Inloggen'}
          variant="primary"
          onPress={() => void submit()}
          loading={busy}
          style={{ marginTop: spacing[2] }}
        />

        <Pressable onPress={() => setMode(isRegister ? 'login' : 'register')} style={styles.switch}>
          <Text style={[typography.callout, { color: theme.color.accent.text }]}>
            {isRegister ? 'Ik heb al een account' : 'Nog geen account? Registreren'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3],
  },
  switch: { alignItems: 'center', paddingVertical: spacing[3] },
});
