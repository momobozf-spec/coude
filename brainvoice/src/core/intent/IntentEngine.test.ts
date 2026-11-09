import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { CommandValidator } from './CommandValidator';
import { DEFAULT_ENGINE_CONFIG } from './config';
import { EMPTY_CONVERSATION_STATE, type ConversationState } from './ContextResolver';
import { IntentEngine, markLastBatch } from './IntentEngine';
import { LLMParser } from './LLMParser';
import type { CommandOf } from './schema';
import type { AIParseContext, AIProvider } from '../ai/AIProvider';
import type { AIParseOutput } from '../ai/schema';

const TZ = 'Europe/Brussels';
const NOW = DateTime.fromISO('2026-09-23T10:00:00', { zone: TZ });

function engine(overrides: Partial<typeof DEFAULT_ENGINE_CONFIG> = {}, llm?: LLMParser) {
  return new IntentEngine({ config: { ...DEFAULT_ENGINE_CONFIG, ...overrides }, llmParser: llm ?? null });
}

async function run(e: IntentEngine, text: string, state: ConversationState = EMPTY_CONVERSATION_STATE, language: 'en' | 'nl' | 'fr' | null = null) {
  return e.process({ text, source: 'text', language, deviceLanguage: 'en', timezone: TZ, now: NOW, state, online: true });
}

describe('IntentEngine – decisions', () => {
  it('confirms a complete high-confidence reminder', async () => {
    const { result } = await run(engine(), 'Remind me tomorrow at 8 to call Yakup.');
    expect(result.decision).toBe('confirm');
    const cmd = result.batch?.commands[0] as CommandOf<'CREATE_REMINDER'>;
    expect(cmd.intent).toBe('CREATE_REMINDER');
    expect(cmd.when?.iso).toBe('2026-09-24T08:00:00+02:00');
    expect(cmd.missingFields).toEqual([]);
  });

  it('asks for the time when a meeting has none', async () => {
    const { result, state } = await run(engine(), 'Plan meeting with Youssef Friday.');
    expect(result.decision).toBe('clarify');
    expect(result.clarification?.field).toBe('time');
    expect(result.clarification?.question).toBe('What time?');
    expect(state.pending?.commandId).toBe(result.batch?.commands[0]?.id);
  });

  it('asks when to remind for a reminder without a date', async () => {
    const { result } = await run(engine(), 'Remind me to send the invoice.');
    expect(result.decision).toBe('clarify');
    expect(result.clarification?.field).toBe('when');
    expect(result.clarification?.question).toBe('When should I remind you?');
  });

  it('does not ask for clarification when adding to a shopping list', async () => {
    const { result } = await run(engine(), 'Add milk to my shopping list.');
    expect(result.decision).toBe('confirm');
    expect(result.batch?.commands[0]?.missingFields).toEqual([]);
  });

  it('auto-executes safe commands only when enabled', async () => {
    const off = await run(engine(), 'Set a timer for 25 minutes.');
    expect(off.result.decision).toBe('confirm');
    const on = await run(engine({ autoExecuteSafeCommands: true }), 'Set a timer for 25 minutes.');
    expect(on.result.decision).toBe('execute');
  });

  it('never auto-executes destructive commands', async () => {
    const { result } = await run(engine({ autoExecuteSafeCommands: true }), 'Delete my meeting with Fabrice.');
    expect(result.decision).toBe('confirm');
    expect(result.batch?.commands[0]?.requiresConfirmation).toBe(true);
  });

  it('flags a past time as an error needing clarification', async () => {
    const { result } = await run(engine(), 'Remind me today at 8 to call Yakup.');
    expect(result.decision).toBe('clarify');
    expect(result.issues[result.batch?.commands[0]?.id ?? '']?.some((i) => i.code === 'PAST_DATE')).toBe(true);
  });

  it('detects the language when none is given', async () => {
    const { result } = await run(engine(), 'Herinner mij morgen om 8 uur om Yakup te bellen.');
    expect(result.language).toBe('nl');
    expect(result.batch?.commands[0]?.intent).toBe('CREATE_REMINDER');
  });
});

describe('IntentEngine – conversational context', () => {
  it('completes a pending reminder with "Friday morning"', async () => {
    const e = engine();
    const first = await run(e, 'Remind me to send the invoice.');
    expect(first.result.decision).toBe('clarify');
    const second = await run(e, 'Friday morning', first.state);
    expect(second.result.usedContext).toBe(true);
    expect(second.result.decision).toBe('confirm');
    const cmd = second.result.batch?.commands[0] as CommandOf<'CREATE_REMINDER'>;
    expect(cmd.title).toBe('Send the invoice');
    expect(cmd.when?.date).toBe('2026-09-25');
    expect(cmd.when?.time).toBe('09:00');
    expect(cmd.warnings).toContain('NO_EXPLICIT_TIME');
  });

  it('completes a pending meeting time with "at 3"', async () => {
    const e = engine();
    const first = await run(e, 'Plan meeting with Youssef Friday.');
    const second = await run(e, 'at 3', first.state);
    expect(second.result.decision).toBe('confirm');
    const cmd = second.result.batch?.commands[0] as CommandOf<'CREATE_CALENDAR_EVENT'>;
    expect(cmd.when?.iso).toBe('2026-09-25T15:00:00+02:00');
  });

  it('applies "make that 3 instead" to the last proposal', async () => {
    const e = engine();
    const first = await run(e, 'Schedule a meeting with Youssef tomorrow at 2.');
    expect(first.result.decision).toBe('confirm');
    const second = await run(e, 'Make that 3 instead.', first.state);
    expect(second.result.usedContext).toBe(true);
    const cmd = second.result.batch?.commands[0] as CommandOf<'CREATE_CALENDAR_EVENT'>;
    expect(cmd.title).toBe('Meeting with Youssef');
    expect(cmd.when?.iso).toBe('2026-09-24T15:00:00+02:00');
    expect(second.result.supersedesBatchId).toBeNull();
  });

  it('marks an executed batch as superseded when modified afterwards', async () => {
    const e = engine();
    const first = await run(e, 'Schedule a meeting with Youssef tomorrow at 2.');
    const executed = markLastBatch(first.state, first.result.batch?.id ?? '', 'executed', NOW);
    const second = await run(e, 'Make that 3 instead.', executed);
    expect(second.result.supersedesBatchId).toBe(first.result.batch?.id);
  });

  it('ignores stale context after the TTL', async () => {
    const e = engine({ contextTtlMinutes: 1 });
    const first = await run(e, 'Remind me to send the invoice.');
    const later = await e.process({ text: 'Friday morning', source: 'text', language: 'en', deviceLanguage: 'en', timezone: TZ, now: NOW.plus({ minutes: 5 }), state: first.state, online: true });
    expect(later.result.usedContext).toBe(false);
  });

  it('works in Dutch and French', async () => {
    const e = engine();
    const nl = await run(e, 'Herinner mij eraan om de factuur te sturen.', EMPTY_CONVERSATION_STATE, 'nl');
    expect(nl.result.clarification?.question).toBe('Wanneer moet ik je herinneren?');
    const nl2 = await run(e, 'vrijdagochtend', nl.state, 'nl');
    expect(nl2.result.usedContext).toBe(true);
    expect((nl2.result.batch?.commands[0] as CommandOf<'CREATE_REMINDER'>).when?.date).toBe('2026-09-25');
    const nl3 = await run(e, 'vrijdag om 9 uur', nl.state, 'nl');
    expect(nl3.result.usedContext).toBe(true);
    expect((nl3.result.batch?.commands[0] as CommandOf<'CREATE_REMINDER'>).when?.time).toBe('09:00');
    const fr = await run(e, "Rappelle-moi d'envoyer la facture.", EMPTY_CONVERSATION_STATE, 'fr');
    const fr2 = await run(e, 'vendredi à 9h', fr.state, 'fr');
    expect(fr2.result.usedContext).toBe(true);
  });
});

class FakeProvider implements AIProvider {
  readonly id = 'fake';
  readonly displayName = 'Fake';
  calls = 0;
  constructor(private readonly output: AIParseOutput) {}
  async isConfigured(): Promise<boolean> {
    return true;
  }
  async parseCommand(_text: string, _ctx: AIParseContext): Promise<AIParseOutput> {
    this.calls++;
    return this.output;
  }
  async summarize(): Promise<string> {
    return 'x';
  }
  async classify(): Promise<{ category: string; confidence: number; tags: string[] }> {
    return { category: 'Work', confidence: 1, tags: [] };
  }
  async extractEntities(): Promise<{ people: string[]; places: string[]; topics: string[] }> {
    return { people: [], places: [], topics: [] };
  }
}

describe('IntentEngine – LLM fallback', () => {
  it('uses the LLM for free text when enabled and resolves dates locally', async () => {
    const provider = new FakeProvider({
      commands: [{ intent: 'CREATE_CALENDAR_EVENT', confidence: 0.93, title: 'Dentist', when: { phrase: 'next Friday at 3', isoDate: '2031-01-01', isoTime: '03:00' }, durationMinutes: 30 }],
    });
    const e = engine({ llmEnabled: true }, new LLMParser(provider));
    const { result } = await run(e, 'dentist thing next Friday at 3');
    expect(provider.calls).toBe(1);
    expect(result.usedLLM).toBe(true);
    const cmd = result.batch?.commands[0] as CommandOf<'CREATE_CALENDAR_EVENT'>;
    expect(cmd.title).toBe('Dentist');
    // local resolution wins over the model's absurd hint
    expect(cmd.when?.iso).toBe('2026-10-02T15:00:00+02:00');
    expect(cmd.durationMinutes).toBe(30);
  });

  it('rejects implausible LLM date hints and asks for the date', async () => {
    const provider = new FakeProvider({
      commands: [{ intent: 'CREATE_REMINDER', confidence: 0.9, title: 'Call mom', when: { phrase: 'gibberish phrase', isoDate: '2020-01-01', isoTime: '10:00' } }],
    });
    const e = engine({ llmEnabled: true }, new LLMParser(provider));
    const { result } = await run(e, 'call mom sometime gibberish');
    expect(result.usedLLM).toBe(true);
    expect(result.decision).toBe('clarify');
    expect(result.batch?.commands[0]?.warnings).toContain('LLM_DATE_REJECTED');
  });

  it('does not call the LLM for confident deterministic results', async () => {
    const provider = new FakeProvider({ commands: [] });
    const e = engine({ llmEnabled: true }, new LLMParser(provider));
    await run(e, 'Remind me tomorrow at 8 to call Yakup.');
    expect(provider.calls).toBe(0);
  });

  it('survives an LLM failure and keeps the deterministic result', async () => {
    const failing: AIProvider = {
      id: 'fail',
      displayName: 'Fail',
      isConfigured: async () => true,
      parseCommand: async () => {
        throw new Error('network down');
      },
      summarize: async () => '',
      classify: async () => ({ category: 'Work', confidence: 0, tags: [] }),
      extractEntities: async () => ({ people: [], places: [], topics: [] }),
    };
    const e = engine({ llmEnabled: true }, new LLMParser(failing));
    const { result } = await run(e, 'The coffee machine is great.');
    expect(result.error?.code).toBe('AI_UNAVAILABLE');
    expect(result.batch?.commands[0]?.intent).toBe('CAPTURE_NOTE');
  });
});

describe('CommandValidator', () => {
  it('reports end before start', () => {
    const validator = new CommandValidator();
    const { command, issues } = validator.validate(
      {
        id: '1', intent: 'CREATE_CALENDAR_EVENT', confidence: 0.95, language: 'en', originalText: 'x', requiresConfirmation: false, missingFields: [], clarificationQuestion: null, parser: 'manual', warnings: [],
        title: 'X', durationMinutes: null, location: null, notes: null, people: [], alerts: [], allDay: false,
        when: { date: '2026-09-25', time: '15:00', endDate: null, endTime: '14:00', iso: '2026-09-25T15:00:00+02:00', endIso: '2026-09-25T14:00:00+02:00', timezone: TZ, hasExplicitDate: true, hasExplicitTime: true, recurrence: null, phrase: null },
      },
      { now: NOW, timezone: TZ, language: 'en', config: DEFAULT_ENGINE_CONFIG },
    );
    expect(issues.some((i) => i.code === 'END_BEFORE_START')).toBe(true);
    expect(command.missingFields).toContain('endTime');
  });
});
