import { describe, expect, it } from 'vitest';

import { captureFlowReducer, INITIAL_FLOW_STATE, type FlowState } from './captureFlowReducer';
import type { CommandBatch } from '../intent/schema';

const batch: CommandBatch = { id: 'b', commands: [], originalText: 'x', transcript: null, language: 'en', source: 'voice', createdAt: '' };

function run(events: Parameters<typeof captureFlowReducer>[1][]): FlowState {
  return events.reduce(captureFlowReducer, INITIAL_FLOW_STATE);
}

describe('captureFlowReducer', () => {
  it('walks the happy path IDLE → LISTENING → TRANSCRIBING → UNDERSTANDING → PREVIEW → EXECUTING → DONE', () => {
    let s = run([{ type: 'START_LISTENING', at: 1 }]);
    expect(s.phase).toBe('LISTENING');
    s = captureFlowReducer(s, { type: 'INTERIM', text: 'remind me' });
    expect(s.interimTranscript).toBe('remind me');
    s = captureFlowReducer(s, { type: 'STOP_LISTENING' });
    expect(s.phase).toBe('TRANSCRIBING');
    s = captureFlowReducer(s, { type: 'TRANSCRIPT', text: 'remind me tomorrow at 8' });
    expect(s.phase).toBe('UNDERSTANDING');
    expect(s.text).toBe('remind me tomorrow at 8');
    s = captureFlowReducer(s, { type: 'UNDERSTOOD', batch, decision: 'confirm', clarification: null });
    expect(s.phase).toBe('PREVIEW');
    s = captureFlowReducer(s, { type: 'CONFIRM' });
    expect(s.phase).toBe('EXECUTING');
    s = captureFlowReducer(s, { type: 'EXECUTED', results: [] });
    expect(s.phase).toBe('DONE');
  });

  it('routes clarification questions into a thread and back to understanding', () => {
    let s = run([{ type: 'TEXT_INPUT', text: 'remind me to send the invoice', source: 'text' }]);
    s = captureFlowReducer(s, { type: 'UNDERSTOOD', batch, decision: 'clarify', clarification: { commandId: 'c', field: 'when', question: 'When should I remind you?' } });
    expect(s.phase).toBe('CLARIFYING');
    expect(s.thread).toEqual([{ role: 'assistant', text: 'When should I remind you?' }]);
    s = captureFlowReducer(s, { type: 'CLARIFY_ANSWER', text: 'Friday morning' });
    expect(s.phase).toBe('UNDERSTANDING');
    expect(s.thread).toHaveLength(2);
    s = captureFlowReducer(s, { type: 'UNDERSTOOD', batch, decision: 'confirm', clarification: null });
    expect(s.phase).toBe('PREVIEW');
  });

  it('keeps the clarification thread when the user answers by voice', () => {
    let s = run([{ type: 'TEXT_INPUT', text: 'x', source: 'text' }, { type: 'UNDERSTOOD', batch, decision: 'clarify', clarification: { commandId: 'c', field: 'time', question: 'What time?' } }]);
    s = captureFlowReducer(s, { type: 'START_LISTENING', at: 2 });
    expect(s.phase).toBe('LISTENING');
    expect(s.clarification?.field).toBe('time');
    s = captureFlowReducer(s, { type: 'TRANSCRIPT', text: 'at 3' });
    expect(s.thread.map((m) => m.role)).toEqual(['assistant', 'user']);
  });

  it('fails on empty transcripts and resets on cancel', () => {
    let s = run([{ type: 'START_LISTENING', at: 1 }, { type: 'TRANSCRIPT', text: '   ' }]);
    expect(s.phase).toBe('ERROR');
    expect(s.error?.code).toBe('SPEECH_RECOGNITION_FAILED');
    s = captureFlowReducer(s, { type: 'CANCEL' });
    expect(s).toEqual(INITIAL_FLOW_STATE);
  });

  it('ignores events that do not apply to the current phase', () => {
    const s = run([{ type: 'CONFIRM' }, { type: 'INTERIM', text: 'x' }]);
    expect(s).toEqual(INITIAL_FLOW_STATE);
  });
});
