import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { getRuntime, useAppStore } from './appStore';
import type { ActionResult } from '@core/commands/ActionRouter';
import { captureFlowReducer, INITIAL_FLOW_STATE, type FlowEvent, type FlowState } from '@core/flow/captureFlowReducer';
import { detectLanguage } from '@core/intent/LanguageDetector';
import type { CommandBatch } from '@core/intent/schema';
import { DomainError, type InputSource, type Language } from '@core/types/common';
import { getSpeechLocale, isOnline } from '@platform/device';
import type { VoiceEvent } from '@platform/voice/VoiceInputService';

/**
 * The capture flow: voice/text → engine → preview → router. UI reads `state`
 * and calls the actions; all side effects live here, the state machine is pure.
 */
export interface CaptureStore {
  state: FlowState;
  dispatch: (event: FlowEvent) => void;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelListening: () => Promise<void>;
  submitText: (text: string, source?: InputSource, transcript?: string | null) => Promise<void>;
  answer: (text: string) => Promise<void>;
  editBatch: (batch: CommandBatch) => void;
  confirm: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
  undo: (historyId: string) => Promise<{ ok: boolean; message: string }>;
  undoLast: () => Promise<void>;
}

let unsubscribeVoice: (() => void) | null = null;
let pendingSupersedes: string | null = null;
let lastInterim = '';

/** Intents that belong to Alfred's domain and run on the server in connected mode; everything else is device work. */
const REMOTE_INTENTS = new Set<string>(['BUTLER_TOOL']);

function haptic(kind: 'light' | 'success' | 'error'): void {
  const enabled = useAppStore.getState().settings.hapticFeedback;
  if (!enabled) return;
  try {
    if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // haptics are optional
  }
}

function resolveLanguage(text: string): Language {
  const rt = getRuntime();
  const preferred = rt.settings.get().language;
  if (preferred !== 'auto') return preferred;
  return detectLanguage(text, rt.deviceLanguage).language;
}

export const useCaptureStore = create<CaptureStore>((set, get) => {
  const dispatch = (event: FlowEvent) => set((s) => ({ state: captureFlowReducer(s.state, event) }));

  const understand = async (text: string, source: InputSource, transcript: string | null): Promise<void> => {
    const rt = getRuntime();
    try {
      const online = await isOnline();
      useAppStore.getState().setOnline(online);
      const language = resolveLanguage(text);
      // Connected mode: Alfred understands on the server (its conversation state, its LLM). Device-only
      // commands still come back as a batch and run locally; Butler commands run on the server.
      if (rt.opsHost.usingServer()) {
        try {
          const remote = await rt.opsHost.client().understand({ text, source, transcript, language });
          pendingSupersedes = remote.supersedesBatchId;
          dispatch({ type: 'UNDERSTOOD', batch: remote.batch, decision: remote.decision, clarification: remote.clarification });
          if (remote.decision === 'execute' && remote.batch) {
            dispatch({ type: 'CONFIRM' });
            await execute(remote.batch, true);
          } else if (remote.decision === 'clarify') {
            haptic('light');
          }
          return;
        } catch (e) {
          const error = DomainError.from(e);
          if (error.code !== 'SERVER_UNAVAILABLE') throw error;
          rt.logger.warn('alfred server unreachable, understanding locally', { message: error.message });
        }
      }
      const contextState = await rt.services.context.load();
      const categories = (await rt.db.categories.list()).map((c) => c.name);
      const { result, state: nextState } = await rt.engine.process({
        text,
        transcript,
        source,
        language,
        deviceLanguage: rt.deviceLanguage,
        timezone: rt.timezone(),
        state: contextState,
        online,
        categories,
      });
      await rt.services.context.save(nextState);
      pendingSupersedes = result.supersedesBatchId;

      if (result.decision === 'unknown' && !online && rt.settings.get().ai.enabled) {
        await rt.services.captures.recordUnprocessed({ text, transcript, source, language, reason: 'offline' });
        useAppStore.getState().bumpData();
        dispatch({ type: 'QUEUED', reason: 'offline' });
        return;
      }
      if (result.error?.code === 'AI_UNAVAILABLE' && result.decision === 'unknown') {
        await rt.services.captures.recordUnprocessed({ text, transcript, source, language, reason: result.error.message });
        useAppStore.getState().bumpData();
        dispatch({ type: 'QUEUED', reason: result.error.message });
        return;
      }
      dispatch({ type: 'UNDERSTOOD', batch: result.batch, decision: result.decision, clarification: result.clarification });
      if (result.decision === 'execute' && result.batch) {
        dispatch({ type: 'CONFIRM' });
        await execute(result.batch, true);
      } else if (result.decision === 'clarify') {
        haptic('light');
      }
    } catch (e) {
      const error = DomainError.from(e);
      rt.logger.error('understand failed', { code: error.code, message: error.message });
      dispatch({ type: 'FAIL', code: error.code, message: error.message });
      haptic('error');
    }
  };

  const execute = async (batch: CommandBatch, autoExecuted: boolean): Promise<void> => {
    const rt = getRuntime();
    try {
      const connected = rt.opsHost.usingServer();
      const remoteCommands = connected ? batch.commands.filter((c) => REMOTE_INTENTS.has(c.intent)) : [];
      const localCommands = batch.commands.filter((c) => !remoteCommands.includes(c));
      const results: ActionResult[] = [];
      if (remoteCommands.length) {
        // Butler commands never run against the phone's database in connected mode; if the server is down they fail visibly.
        const remote = await rt.opsHost.client().executeBatch({ ...batch, commands: remoteCommands }, { supersedesBatchId: pendingSupersedes });
        results.push(...remote.map((r) => ({ ...r, error: r.error ? new DomainError(r.error.code, r.error.message) : null, origin: 'remote' as const })));
      }
      if (localCommands.length) {
        if (pendingSupersedes) {
          const previous = await rt.services.history.listByBatch(pendingSupersedes);
          for (const entry of previous) if (entry.undoStatus === 'available') await rt.router.undo(entry.id);
        }
        const local = await rt.router.execute({ ...batch, commands: localCommands });
        results.push(...local.map((r) => ({ ...r, origin: 'local' as const })));
      }
      pendingSupersedes = null;
      const order = new Map(batch.commands.map((c, i) => [c.id, i]));
      results.sort((a, b) => (order.get(a.commandId) ?? 0) - (order.get(b.commandId) ?? 0));
      dispatch({ type: 'EXECUTED', results, autoExecuted });
      useAppStore.getState().bumpData();
      haptic(results.every((r) => r.ok) ? 'success' : 'error');
    } catch (e) {
      const error = DomainError.from(e);
      rt.logger.error('execute failed', { code: error.code, message: error.message });
      dispatch({ type: 'FAIL', code: error.code, message: error.message });
      haptic('error');
    }
  };

  const detachVoice = () => {
    unsubscribeVoice?.();
    unsubscribeVoice = null;
  };

  const onVoiceEvent = (event: VoiceEvent) => {
    const phase = get().state.phase;
    switch (event.type) {
      case 'interim':
        lastInterim = event.transcript;
        dispatch({ type: 'INTERIM', text: event.transcript });
        return;
      case 'volume':
        dispatch({ type: 'VOLUME', value: event.value });
        return;
      case 'final': {
        detachVoice();
        const text = event.transcript.trim() || lastInterim.trim();
        dispatch({ type: 'TRANSCRIPT', text });
        if (text) void understand(text, 'voice', event.transcript);
        return;
      }
      case 'end': {
        if (phase === 'LISTENING' || phase === 'TRANSCRIBING') {
          detachVoice();
          const text = lastInterim.trim();
          dispatch({ type: 'TRANSCRIPT', text });
          if (text) void understand(text, 'voice', text);
        }
        return;
      }
      case 'error':
        detachVoice();
        dispatch({ type: 'FAIL', code: event.code, message: event.message });
        haptic('error');
        return;
      case 'start':
      default:
        return;
    }
  };

  return {
    state: INITIAL_FLOW_STATE,
    dispatch,

    startListening: async () => {
      const rt = getRuntime();
      if (!rt.voice.isAvailable()) {
        dispatch({ type: 'FAIL', code: 'SPEECH_NOT_AVAILABLE', message: 'Speech recognition unavailable' });
        return;
      }
      let permission = await rt.voice.getPermission();
      if (permission !== 'granted') permission = await rt.voice.requestPermission();
      if (permission !== 'granted') {
        dispatch({ type: 'FAIL', code: 'MIC_PERMISSION_DENIED', message: 'Microphone permission not granted' });
        return;
      }
      lastInterim = '';
      detachVoice();
      unsubscribeVoice = rt.voice.subscribe(onVoiceEvent);
      dispatch({ type: 'START_LISTENING', at: Date.now() });
      haptic('light');
      const settings = rt.settings.get();
      const language = settings.language === 'auto' ? rt.deviceLanguage : settings.language;
      try {
        await rt.voice.start({
          locale: settings.voice.locale ?? getSpeechLocale(language),
          interimResults: settings.voice.interimResults,
          onDevice: settings.voice.onDeviceOnly,
        });
      } catch (e) {
        detachVoice();
        const error = DomainError.from(e, 'SPEECH_RECOGNITION_FAILED');
        dispatch({ type: 'FAIL', code: error.code, message: error.message });
      }
    },

    stopListening: async () => {
      dispatch({ type: 'STOP_LISTENING' });
      await getRuntime().voice.stop();
    },

    cancelListening: async () => {
      detachVoice();
      await getRuntime().voice.abort();
      dispatch({ type: 'CANCEL' });
    },

    submitText: async (text, source = 'text', transcript = null) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      dispatch({ type: 'TEXT_INPUT', text: trimmed, source });
      await understand(trimmed, source, transcript);
    },

    answer: async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      dispatch({ type: 'CLARIFY_ANSWER', text: trimmed });
      await understand(trimmed, get().state.source, null);
    },

    editBatch: (batch) => dispatch({ type: 'EDIT_BATCH', batch }),

    confirm: async () => {
      const batch = get().state.batch;
      if (!batch || get().state.phase !== 'PREVIEW') return;
      dispatch({ type: 'CONFIRM' });
      await execute(batch, false);
    },

    cancel: () => {
      detachVoice();
      void getRuntime().voice.abort();
      pendingSupersedes = null;
      dispatch({ type: 'CANCEL' });
    },

    reset: () => {
      detachVoice();
      pendingSupersedes = null;
      dispatch({ type: 'RESET' });
    },

    undo: async (historyId) => {
      const rt = getRuntime();
      // Entries not in the current results come from the history screen: server history in connected mode.
      const origin = get().state.results.find((r) => r.historyId === historyId)?.origin ?? (rt.opsHost.usingServer() ? 'remote' : 'local');
      const result = origin === 'remote' ? await rt.opsHost.client().undo(historyId) : await rt.router.undo(historyId);
      useAppStore.getState().bumpData();
      haptic(result.ok ? 'success' : 'error');
      set((s) => ({ state: { ...s.state, results: s.state.results.map((r) => (r.historyId === historyId ? { ...r, undoable: false } : r)) } }));
      return result;
    },

    undoLast: async () => {
      const results = get().state.results.filter((r) => r.undoable && r.historyId);
      for (const r of results) if (r.historyId) await get().undo(r.historyId);
    },
  };
});
