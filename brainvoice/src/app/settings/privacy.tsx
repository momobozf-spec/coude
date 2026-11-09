import { Stack } from 'expo-router';
import React from 'react';
import { Alert, Switch } from 'react-native';

import { eraseAllData } from '@core/db/Database';
import { useLanguage, useSettings, useUpdateSettings } from '@runtime/hooks';
import { getRuntime, useAppStore } from '@runtime/stores/appStore';
import { AppText, Button, Card, Row, Screen, SectionHeader } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { spacing, useTheme } from '@ui/theme';

const EXPLAINER: Record<'en' | 'nl' | 'fr', string[]> = {
  en: [
    'Everything you capture is stored on this phone in a local database. There is no account and no cloud sync.',
    'Raw audio is never stored. The microphone only runs while you hold or tap the button, and the system indicator shows when it is active.',
    'Speech-to-text uses the phone’s built-in recogniser (Apple Speech / Android SpeechRecognizer), which may use the vendor’s servers depending on your device settings. You can force on-device recognition in AI & language.',
    'Cloud AI is off by default. When enabled, only the text of the command you just said is sent to the AI provider, never your calendar, notes, contacts or history.',
    'Permissions are requested only when a feature needs them: microphone to listen, calendar to add events, reminders to create reminders, notifications to alert you, alarms for real alarms.',
  ],
  nl: [
    'Alles wat je vastlegt wordt op deze telefoon in een lokale database bewaard. Er is geen account en geen cloud-synchronisatie.',
    'Ruwe audio wordt nooit bewaard. De microfoon werkt alleen terwijl je de knop ingedrukt houdt of tikt, en de systeemindicator toont wanneer hij actief is.',
    'Spraak-naar-tekst gebruikt de ingebouwde herkenning van de telefoon (Apple Speech / Android SpeechRecognizer), die afhankelijk van je instellingen servers van de fabrikant kan gebruiken. Je kunt herkenning op het toestel afdwingen in AI & taal.',
    'Cloud-AI staat standaard uit. Indien ingeschakeld wordt enkel de tekst van de opdracht die je net zei naar de AI-provider gestuurd, nooit je agenda, notities, contacten of geschiedenis.',
    'Toestemmingen worden enkel gevraagd wanneer een functie ze nodig heeft: microfoon om te luisteren, agenda om afspraken toe te voegen, herinneringen, meldingen, wekkers.',
  ],
  fr: [
    'Tout ce que tu captures est stocké sur ce téléphone dans une base locale. Pas de compte, pas de synchronisation cloud.',
    'L’audio brut n’est jamais conservé. Le micro ne fonctionne que pendant que tu tiens ou touches le bouton, et l’indicateur système montre quand il est actif.',
    'La reconnaissance vocale utilise celle du téléphone (Apple Speech / Android SpeechRecognizer), qui peut utiliser les serveurs du fabricant selon tes réglages. Tu peux forcer la reconnaissance sur l’appareil dans IA & langue.',
    'L’IA cloud est désactivée par défaut. Si elle est activée, seul le texte de la commande que tu viens de dire est envoyé au fournisseur d’IA, jamais ton calendrier, tes notes, tes contacts ou ton historique.',
    'Les autorisations ne sont demandées que lorsqu’une fonction en a besoin : micro, calendrier, rappels, notifications, alarmes.',
  ],
};

export default function PrivacyScreen(): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const strings = ui(language);
  const settings = useSettings();
  const update = useUpdateSettings();
  const bump = useAppStore((s) => s.bumpData);

  const erase = () => {
    Alert.alert(strings.eraseAll, strings.eraseConfirm, [
      { text: strings.cancel, style: 'cancel' },
      { text: strings.eraseAll, style: 'destructive', onPress: () => void eraseAllData(getRuntime().db).then(bump) },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: strings.privacy }} />
      {EXPLAINER[language].map((p) => (
        <AppText key={p.slice(0, 24)} muted style={{ marginBottom: spacing.md }}>
          {p}
        </AppText>
      ))}
      <SectionHeader title={strings.keepTranscripts} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1 }}>{strings.keepTranscripts}</AppText>
          <Switch value={settings.privacy.keepTranscripts} onValueChange={(v) => void update({ privacy: { keepTranscripts: v } })} trackColor={{ true: theme.colors.accent }} accessibilityLabel={strings.keepTranscripts} />
        </Row>
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {strings.keepTranscriptsHint}
        </AppText>
      </Card>
      <SectionHeader title={strings.cloudAI} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText style={{ flex: 1 }}>{strings.cloudAI}</AppText>
          <Switch value={settings.privacy.cloudAIConsent} onValueChange={(v) => void update({ privacy: { cloudAIConsent: v }, ai: { enabled: v ? settings.ai.enabled : false } })} trackColor={{ true: theme.colors.accent }} accessibilityLabel={strings.cloudAI} />
        </Row>
        <AppText variant="caption" muted style={{ marginTop: spacing.sm }}>
          {strings.cloudAIHint}
        </AppText>
      </Card>
      <SectionHeader title="" />
      <Button title={strings.eraseAll} variant="danger" icon="trash-outline" onPress={erase} />
    </Screen>
  );
}
