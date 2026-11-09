import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ActionCard } from './ActionCard';
import { ResultList } from './ResultList';
import { explainError } from '@core/errors/messages';
import { isBusy } from '@core/flow/captureFlowReducer';
import type { Command } from '@core/intent/schema';
import { useLanguage, useTimezone } from '@runtime/hooks';
import { useAppStore } from '@runtime/stores/appStore';
import { useCaptureStore } from '@runtime/stores/captureStore';
import { MicButton } from '@ui/MicButton';
import { AppText, Button, Card, Row } from '@ui/primitives';
import { ui } from '@ui/i18n';
import { radius, spacing, useTheme } from '@ui/theme';

/**
 * The capture experience: mic + live transcript + status → action preview
 * (stack of cards, edit before execution) → results with undo.
 * Used inline on Home and full-screen on /capture (Siri, shortcuts, widget).
 */
export function CaptureFlow({ compact = false, autoStart = false, initialText }: { compact?: boolean; autoStart?: boolean; initialText?: string | null }): React.JSX.Element {
  const theme = useTheme();
  const language = useLanguage();
  const timezone = useTimezone();
  const strings = ui(language);
  const state = useCaptureStore((s) => s.state);
  const { startListening, stopListening, submitText, answer, confirm, cancel, reset, editBatch, undo } = useCaptureStore();
  const online = useAppStore((s) => s.online);
  const [text, setText] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialText) void submitText(initialText, 'siri');
    else if (autoStart) void startListening();
  }, [autoStart, initialText, startListening, submitText]);

  const onMic = () => {
    if (state.phase === 'LISTENING') void stopListening();
    else if (!isBusy(state.phase)) void startListening();
  };

  const onSend = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    if (state.phase === 'CLARIFYING') void answer(value);
    else void submitText(value, 'text');
  };

  const statusText =
    state.phase === 'LISTENING' ? (state.interimTranscript || strings.listening) : state.phase === 'TRANSCRIBING' ? strings.transcribing : state.phase === 'UNDERSTANDING' ? strings.understanding : state.phase === 'EXECUTING' ? strings.executing : null;

  const micLabel = state.phase === 'LISTENING' ? strings.tapToStop : strings.tapToSpeak;
  const showMic = state.phase === 'IDLE' || state.phase === 'LISTENING' || state.phase === 'TRANSCRIBING' || state.phase === 'UNDERSTANDING' || state.phase === 'CLARIFYING';

  return (
    <View style={{ gap: spacing.lg }}>
      {showMic ? (
        <View style={{ alignItems: 'center' }}>
          <MicButton phase={state.phase} volume={state.volume} onPress={onMic} size={compact ? 104 : 128} accessibilityLabel={micLabel} />
          <AppText variant={state.phase === 'LISTENING' ? 'body' : 'caption'} muted style={{ textAlign: 'center', minHeight: 24, marginTop: -spacing.md }} accessibilityLiveRegion="polite">
            {statusText ?? micLabel}
          </AppText>
          {state.phase === 'IDLE' && !online ? (
            <AppText variant="caption" color={theme.colors.warning} style={{ marginTop: spacing.xs }}>
              offline
            </AppText>
          ) : null}
        </View>
      ) : null}

      {state.phase === 'CLARIFYING' ? (
        <Card tone="alt">
          {state.thread.map((m, i) => (
            <AppText key={`${i}-${m.role}`} style={{ marginBottom: 4 }} color={m.role === 'assistant' ? theme.colors.text : theme.colors.textMuted}>
              {m.role === 'assistant' ? '● ' : '○ '}
              {m.text}
            </AppText>
          ))}
          {state.batch && state.clarification?.field === 'intent' ? (
            <Row style={{ marginTop: spacing.md }}>
              <Button title={strings.confirm} compact onPress={() => editBatch(state.batch!)} icon="checkmark" />
              <Button title={strings.cancel} variant="ghost" compact onPress={cancel} />
            </Row>
          ) : null}
        </Card>
      ) : null}

      {state.phase === 'PREVIEW' && state.batch ? (
        <View style={{ gap: spacing.md }}>
          {state.batch.commands.map((command) => (
            <ActionCard
              key={command.id}
              command={command}
              language={language}
              timezone={timezone}
              editable
              issues={command.warnings.filter((w) => w !== 'fallback').map((w) => warningText(w, language))}
              onChange={(next: Command) => editBatch({ ...state.batch!, commands: state.batch!.commands.map((c) => (c.id === next.id ? next : c)) })}
            />
          ))}
          <Row style={{ justifyContent: 'space-between' }}>
            <Button title={strings.cancel} variant="ghost" onPress={cancel} />
            <Button title={strings.confirm} onPress={() => void confirm()} icon="checkmark" style={{ flex: 1, marginLeft: spacing.md }} accessibilityHint="Executes the actions shown above" />
          </Row>
        </View>
      ) : null}

      {state.phase === 'DONE' ? (
        <View style={{ gap: spacing.md }}>
          {state.autoExecuted ? (
            <AppText variant="caption" faint>
              {strings.executedAutomatically}
            </AppText>
          ) : null}
          <ResultList results={state.results} language={language} timezone={timezone} onUndo={(id) => void undo(id)} />
          <Row style={{ justifyContent: 'flex-end' }}>
            <Button title={strings.close} variant="secondary" onPress={reset} icon="mic-outline" />
          </Row>
        </View>
      ) : null}

      {state.phase === 'QUEUED' ? (
        <Card tone="alt">
          <AppText variant="heading">{strings.queued}</AppText>
          <AppText muted style={{ marginTop: spacing.xs }}>
            {strings.queuedBody}
          </AppText>
          <Row style={{ marginTop: spacing.md, justifyContent: 'flex-end' }}>
            <Button title={strings.brainInbox} variant="secondary" compact onPress={() => router.push('/(tabs)/inbox')} />
            <Button title={strings.close} variant="ghost" compact onPress={reset} />
          </Row>
        </Card>
      ) : null}

      {state.phase === 'ERROR' && state.error ? (
        <Card tone="alt">
          <Row>
            <Ionicons name="alert-circle" size={20} color={theme.colors.danger} />
            <AppText style={{ flex: 1 }}>{explainError(state.error.code, language)}</AppText>
          </Row>
          <Row style={{ marginTop: spacing.md, justifyContent: 'flex-end' }}>
            {state.error.code === 'MIC_PERMISSION_DENIED' || state.error.code === 'CALENDAR_PERMISSION_DENIED' || state.error.code === 'NOTIFICATION_PERMISSION_DENIED' ? (
              <Button title={strings.openSettings} variant="secondary" compact onPress={() => void Linking.openSettings()} />
            ) : null}
            <Button title={strings.retry} variant="secondary" compact onPress={reset} icon="refresh" />
          </Row>
        </Card>
      ) : null}

      {state.phase === 'IDLE' || state.phase === 'CLARIFYING' ? (
        <Row gap={spacing.sm}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={onSend}
            placeholder={state.phase === 'CLARIFYING' ? (state.clarification?.question ?? strings.typeCommand) : strings.typeCommand}
            placeholderTextColor={theme.colors.textFaint}
            returnKeyType="send"
            blurOnSubmit
            style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
            accessibilityLabel={strings.typeCommand}
          />
          <Pressable onPress={onSend} accessibilityRole="button" accessibilityLabel={strings.send} style={[styles.send, { backgroundColor: text.trim() ? theme.colors.accent : theme.colors.surfaceAlt }]}>
            <Ionicons name="arrow-up" size={20} color={text.trim() ? theme.colors.onAccent : theme.colors.textFaint} />
          </Pressable>
        </Row>
      ) : null}
    </View>
  );
}

function warningText(code: string, language: 'en' | 'nl' | 'fr'): string {
  const table: Record<string, Record<'en' | 'nl' | 'fr', string>> = {
    NO_EXPLICIT_TIME: { en: 'No exact time was said; a default was used.', nl: 'Geen exact uur gezegd; standaardtijd gebruikt.', fr: 'Aucune heure précise ; heure par défaut utilisée.' },
    PAST_DATE: { en: 'This moment is in the past.', nl: 'Dit moment ligt in het verleden.', fr: 'Ce moment est passé.' },
    LOW_CONFIDENCE: { en: 'Interpretation is uncertain.', nl: 'Interpretatie is onzeker.', fr: 'Interprétation incertaine.' },
    DESTRUCTIVE: { en: 'Changes existing data.', nl: 'Wijzigt bestaande gegevens.', fr: 'Modifie des données existantes.' },
    LLM_DATE_HINT: { en: 'Date suggested by AI – please check.', nl: 'Datum voorgesteld door AI – even nakijken.', fr: 'Date proposée par l’IA – à vérifier.' },
    LLM_DATE_REJECTED: { en: 'AI date was implausible and ignored.', nl: 'AI-datum was onwaarschijnlijk en genegeerd.', fr: 'Date IA invraisemblable, ignorée.' },
  };
  return table[code]?.[language] ?? code;
}

const styles = StyleSheet.create({
  input: { flex: 1, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, minHeight: 48 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
