import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { LogoMark, useTheme } from '@superrette/ui';
import { useSession } from '../state/session';

/** Entry gate: welcome → onboarding → home. */
export default function Index(): ReactNode {
  const { status, user } = useSession();
  const { colors } = useTheme();
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <LogoMark size={72} />
      </View>
    );
  }
  if (status === 'signed-out') return <Redirect href="/welcome" />;
  if (!user?.onboardingCompleted) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
