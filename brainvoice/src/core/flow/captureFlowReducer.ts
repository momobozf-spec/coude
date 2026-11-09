import type { ActionResult } from '../commands/ActionRouter';
import type { Clarification, EngineDecision } from '../intent/IntentEngine';
import type { CommandBatch } from '../intent/schema';
import type { DomainErrorCode, InputSource } from '../types/common';

/**
 * The voice/text capture flow as a pure state machine:
 *
 *   IDLE → LISTENING → TRANSCRIBING → UNDERSTANDING → PREVIEW → EXECUTING → DONE
 *                                            ↘ CLARIFYING ↗            ↘ ERROR
 *
 * The UI renders `state.phase`; the runtime dispatches events. No side effects here.
 */

export type FlowPhase = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'UNDERSTANDING' | 'PREVIEW' | 'CLARIFYING' | 'EXECUTING' | 'DONE' | 'ERROR' | 'QUEUED';

export interface FlowState {
  phase: FlowPhase;
  source: InputSource;
  /** Live transcription (interim) while listening. */
  interimTranscript: string;
  /** Final transcript or typed text. */
  text: string;
  batch: CommandBatch | null;
  decision: EngineDecision | null;
  clarification: Clarification | null;
  /** Question/answer pairs shown in the clarification thread. */
  thread: { role: 'assistant' | 'user'; text: string }[];
  results: ActionResult[];
  error: { code: DomainErrorCode; message: string } | null;
  volume: number;
  startedAt: number | null;
  autoExecuted: boolean;
}

export const INITIAL_FLOW_STATE: FlowState = {
  phase: 'IDLE',
  source: 'voice',
  interimTranscript: '',
  text: '',
  batch: null,
  decision: null,
  clarification: null,
  thread: [],
  results: [],
  error: null,
  volume: 0,
  startedAt: null,
  autoExecuted: false,
};

export type FlowEvent =
  | { type: 'START_LISTENING'; at: number }
  | { type: 'INTERIM'; text: string }
  | { type: 'VOLUME'; value: number }
  | { type: 'STOP_LISTENING' }
  | { type: 'TRANSCRIPT'; text: string }
  | { type: 'TEXT_INPUT'; text: string; source: InputSource }
  | { type: 'UNDERSTOOD'; batch: CommandBatch | null; decision: EngineDecision; clarification: Clarification | null }
  | { type: 'CLARIFY_ANSWER'; text: string }
  | { type: 'EDIT_BATCH'; batch: CommandBatch }
  | { type: 'CONFIRM' }
  | { type: 'EXECUTED'; results: ActionResult[]; autoExecuted?: boolean }
  | { type: 'QUEUED'; reason: string }
  | { type: 'FAIL'; code: DomainErrorCode; message: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export function captureFlowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'START_LISTENING':
      return { ...INITIAL_FLOW_STATE, phase: 'LISTENING', source: 'voice', startedAt: event.at, thread: state.phase === 'CLARIFYING' ? state.thread : [], batch: state.phase === 'CLARIFYING' ? state.batch : null, clarification: state.phase === 'CLARIFYING' ? state.clarification : null };
    case 'INTERIM':
      if (state.phase !== 'LISTENING') return state;
      return { ...state, interimTranscript: event.text };
    case 'VOLUME':
      if (state.phase !== 'LISTENING') return state;
      return { ...state, volume: event.value };
    case 'STOP_LISTENING':
      if (state.phase !== 'LISTENING') return state;
      return { ...state, phase: 'TRANSCRIBING' };
    case 'TRANSCRIPT': {
      if (state.phase !== 'LISTENING' && state.phase !== 'TRANSCRIBING') return state;
      const text = event.text.trim();
      if (!text) return { ...state, phase: 'ERROR', error: { code: 'SPEECH_RECOGNITION_FAILED', message: 'No speech detected' } };
      const answering = state.clarification !== null;
      return { ...state, phase: 'UNDERSTANDING', text, interimTranscript: '', thread: answering ? [...state.thread, { role: 'user', text }] : state.thread };
    }
    case 'TEXT_INPUT': {
      const text = event.text.trim();
      if (!text) return state;
      const answering = state.phase === 'CLARIFYING' && state.clarification !== null;
      return { ...(answering ? state : INITIAL_FLOW_STATE), phase: 'UNDERSTANDING', source: event.source, text, thread: answering ? [...state.thread, { role: 'user', text }] : [] };
    }
    case 'UNDERSTOOD': {
      if (state.phase !== 'UNDERSTANDING') return state;
      if (event.decision === 'clarify' && event.clarification) {
        return { ...state, phase: 'CLARIFYING', batch: event.batch, decision: event.decision, clarification: event.clarification, thread: [...state.thread, { role: 'assistant', text: event.clarification.question }] };
      }
      if (event.decision === 'unknown' || !event.batch) {
        return { ...state, phase: 'CLARIFYING', batch: event.batch, decision: event.decision, clarification: event.clarification, thread: event.clarification ? [...state.thread, { role: 'assistant', text: event.clarification.question }] : state.thread };
      }
      return { ...state, phase: 'PREVIEW', batch: event.batch, decision: event.decision, clarification: null };
    }
    case 'CLARIFY_ANSWER': {
      if (state.phase !== 'CLARIFYING') return state;
      const text = event.text.trim();
      if (!text) return state;
      return { ...state, phase: 'UNDERSTANDING', text, thread: [...state.thread, { role: 'user', text }] };
    }
    case 'EDIT_BATCH':
      if (state.phase !== 'PREVIEW' && state.phase !== 'CLARIFYING') return state;
      return { ...state, phase: 'PREVIEW', batch: event.batch, decision: 'confirm', clarification: null };
    case 'CONFIRM':
      if (state.phase !== 'PREVIEW' || !state.batch) return state;
      return { ...state, phase: 'EXECUTING' };
    case 'EXECUTED':
      if (state.phase !== 'EXECUTING' && state.phase !== 'UNDERSTANDING') return state;
      return { ...state, phase: 'DONE', results: event.results, autoExecuted: event.autoExecuted ?? false };
    case 'QUEUED':
      return { ...state, phase: 'QUEUED', error: { code: 'NO_INTERNET', message: event.reason } };
    case 'FAIL':
      return { ...state, phase: 'ERROR', error: { code: event.code, message: event.message } };
    case 'CANCEL':
    case 'RESET':
      return INITIAL_FLOW_STATE;
    default:
      return state;
  }
}

export function isBusy(phase: FlowPhase): boolean {
  return phase === 'LISTENING' || phase === 'TRANSCRIBING' || phase === 'UNDERSTANDING' || phase === 'EXECUTING';
}
