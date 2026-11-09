import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { CaptureFlow } from '@features/capture/CaptureFlow';
import { useLanguage } from '@runtime/hooks';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { AppText, Screen } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

const KIND_PREFIX: Record<string, Record<'en' | 'nl' | 'fr', string>> = {
  task: { en: 'Task: ', nl: 'Taak: ', fr: 'Tâche : ' },
  reminder: { en: 'Remind me ', nl: 'Herinner mij ', fr: 'Rappelle-moi ' },
  idea: { en: 'Idea: ', nl: 'Idee: ', fr: 'Idée : ' },
  event: { en: 'Put in my calendar: ', nl: 'Zet in mijn agenda: ', fr: 'Mets dans mon agenda : ' },
  alarm: { en: 'Set an alarm ', nl: 'Zet een wekker ', fr: 'Mets un réveil ' },
};

/**
 * Full-screen capture. Entry point for deep links:
 *   brainvoice://capture?text=…&source=siri|shortcut|widget&kind=task|reminder|…&autostart=1
 */
export default function CaptureScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const strings = ui(language);
  const params = useLocalSearchParams<{ text?: string; source?: string; kind?: string; autostart?: string }>();
  const reset = useCaptureStore((s) => s.reset);
  const text = typeof params.text === 'string' ? params.text.trim() : '';
  const kind = typeof params.kind === 'string' ? params.kind : '';
  const prefix = kind && KIND_PREFIX[kind] ? KIND_PREFIX[kind][language] : '';
  const initialText = text ? (prefix && !text.toLowerCase().startsWith(prefix.trim().toLowerCase()) ? `${prefix}${text}` : text) : null;
  const autoStart = params.autostart === '1' || (!text && params.source === 'widget');

  useEffect(() => {
    reset();
    return () => reset();
  }, [reset]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }}>
        <AppText variant="title">{strings.whatsOnYourMind}</AppText>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={strings.close} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.textMuted} />
        </Pressable>
      </View>
      {prefix && !initialText ? (
        <AppText muted style={{ marginBottom: spacing.lg }}>
          {prefix}…
        </AppText>
      ) : null}
      <CaptureFlow autoStart={autoStart} initialText={initialText} />
    </Screen>
  );
}
