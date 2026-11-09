import { DateTime } from 'luxon';

import { type CommandValidator, commandValidator as defaultValidator, type ValidationIssue } from './CommandValidator';
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from './config';
import { type ContextResolver, contextResolver as defaultContextResolver, type ConversationState } from './ContextResolver';
import { type DeterministicParser, deterministicParser as defaultParser } from './DeterministicParser';
import { detectLanguage } from './LanguageDetector';
import type { LLMParser } from './LLMParser';
import { isAutoExecutable, type Command, type CommandBatch } from './schema';
import type { AdminParser } from '../butler/AdminParser';
import { t } from '../i18n/strings';
import { DomainError, type InputSource, type Language } from '../types/common';
import { newId } from '../util/id';

/**
 * IntentEngine – the single entry point from text to validated commands.
 *
 *   text → context resolution → deterministic parser → (LLM parser) →
 *   validation → decision (execute | confirm | clarify | unknown)
 *
 * Nothing here touches the platform; execution happens in the ActionRouter.
 */

export type EngineDecision = 'execute' | 'confirm' | 'clarify' | 'unknown';

export interface EngineInput {
  text: string;
  transcript?: string | null;
  source: InputSource;
  /** Language of the speech recogniser / typed text when known; otherwise detected. */
  language?: Language | null;
  deviceLanguage: Language;
  timezone: string;
  now?: DateTime;
  state: ConversationState;
  /** Whether the network is reachable; the LLM is skipped when false. */
  online?: boolean;
  /** Category names for the LLM prompt. */
  categories?: string[];
}

export interface Clarification {
  commandId: string;
  field: string;
  question: string;
}

export interface EngineResult {
  batch: CommandBatch | null;
  decision: EngineDecision;
  clarification: Clarification | null;
  issues: Record<string, ValidationIssue[]>;
  usedLLM: boolean;
  usedContext: boolean;
  supersedesBatchId: string | null;
  language: Language;
  timings: { totalMs: number; llmMs: number | null };
  error: DomainError | null;
}

export interface EngineOutput {
  result: EngineResult;
  state: ConversationState;
}

export interface IntentEngineDeps {
  parser?: DeterministicParser;
  validator?: CommandValidator;
  contextResolver?: ContextResolver;
  llmParser?: LLMParser | null;
  /** Administrative / project-management commands (Butler tools); optional so the capture-only engine stays unchanged. */
  adminParser?: AdminParser | null;
  config?: EngineConfig;
  logger?: { warn: (message: string, meta?: Record<string, unknown>) => void };
}

function maxConfidence(batch: CommandBatch): number {
  return Math.min(...batch.commands.map((c) => c.confidence));
}

export class IntentEngine {
  private readonly parser: DeterministicParser;
  private readonly validator: CommandValidator;
  private readonly context: ContextResolver;
  private llmParser: LLMParser | null;
  private adminParser: AdminParser | null;
  private config: EngineConfig;
  private readonly logger: { warn: (message: string, meta?: Record<string, unknown>) => void };

  constructor(deps: IntentEngineDeps = {}) {
    this.parser = deps.parser ?? defaultParser;
    this.validator = deps.validator ?? defaultValidator;
    this.context = deps.contextResolver ?? defaultContextResolver;
    this.llmParser = deps.llmParser ?? null;
    this.adminParser = deps.adminParser ?? null;
    this.config = deps.config ?? DEFAULT_ENGINE_CONFIG;
    this.logger = deps.logger ?? { warn: () => undefined };
  }

  setLLMParser(parser: LLMParser | null): void {
    this.llmParser = parser;
  }

  setAdminParser(parser: AdminParser | null): void {
    this.adminParser = parser;
  }

  setConfig(config: EngineConfig): void {
    this.config = config;
  }

  getConfig(): EngineConfig {
    return this.config;
  }

  async process(input: EngineInput): Promise<EngineOutput> {
    const started = Date.now();
    const now = input.now ?? DateTime.now().setZone(input.timezone);
    const text = input.text.trim();
    const language = input.language ?? detectLanguage(text, input.deviceLanguage).language;
    let usedLLM = false;
    let usedContext = false;
    let llmMs: number | null = null;
    let error: DomainError | null = null;
    let supersedesBatchId: string | null = null;

    if (!text) {
      return this.finish({ batch: null, decision: 'unknown', language, usedLLM, usedContext, supersedesBatchId, started, llmMs, error, state: input.state, now });
    }

    // 1. Conversation context: answers to clarifications and "make that 3 instead".
    let batch: CommandBatch | null = null;
    const ctxResult = this.context.resolve({ text, language, now, timezone: input.timezone, state: input.state, ttlMinutes: this.config.contextTtlMinutes });
    if (ctxResult) {
      batch = ctxResult.batch;
      usedContext = true;
      supersedesBatchId = ctxResult.supersedesBatchId;
    }

    // 1b. A Butler tool asked for missing information ("What should I invoice?") – complete it with the answer.
    const pendingTool = input.state.pending?.batch.commands.find((c) => c.id === input.state.pending?.commandId);
    if (!batch && this.adminParser && pendingTool?.intent === 'BUTLER_TOOL' && input.state.pending && !isExpiredAt(input.state.pending.createdAt, now, this.config.contextTtlMinutes)) {
      const completed = this.adminParser.complete(pendingTool, text, { text, language, now, timezone: input.timezone, source: input.source, transcript: input.transcript ?? null, focus: input.state.focus ?? null });
      if (completed) {
        batch = completed;
        usedContext = true;
      }
    }

    // 2a. Administrative / project-management commands (Butler tools, spec §132).
    if (!batch && this.adminParser) {
      batch = this.adminParser.parse({ text, language, now, timezone: input.timezone, source: input.source, transcript: input.transcript ?? null, focus: input.state.focus ?? null });
    }

    // 2b. Deterministic capture parser.
    if (!batch) {
      batch = this.parser.parse({ text, language, now, timezone: input.timezone, source: input.source, transcript: input.transcript ?? null });
    }

    // 3. LLM fallback / second opinion.
    const unsure = !batch || maxConfidence(batch) < this.config.llmFallbackBelow || batch.commands.some((c) => c.intent === 'UNKNOWN' || c.warnings.includes('fallback'));
    if (unsure && this.config.llmEnabled && this.llmParser && input.online !== false && !usedContext) {
      const llmStarted = Date.now();
      try {
        const llmBatch = await this.llmParser.parse({
          text,
          language,
          now,
          timezone: input.timezone,
          source: input.source,
          transcript: input.transcript ?? null,
          categories: input.categories ?? [],
          pendingQuestion: input.state.pending?.question ?? null,
          lastCommandSummary: input.state.lastBatch ? summarizeBatch(input.state.lastBatch.batch) : null,
        });
        llmMs = Date.now() - llmStarted;
        if (llmBatch && (!batch || maxConfidence(llmBatch) > maxConfidence(batch))) {
          batch = llmBatch;
          usedLLM = true;
        }
      } catch (e) {
        llmMs = Date.now() - llmStarted;
        error = DomainError.from(e, 'AI_UNAVAILABLE');
        this.logger.warn('LLM parser failed; using deterministic result', { code: error.code, message: error.message });
      }
    }

    if (!batch) {
      return this.finish({ batch: null, decision: 'unknown', language, usedLLM, usedContext, supersedesBatchId, started, llmMs, error, state: input.state, now });
    }

    // 4. Validation.
    const issues: Record<string, ValidationIssue[]> = {};
    const validated: Command[] = batch.commands.map((command) => {
      const result = this.validator.validate(command, { now, timezone: input.timezone, language, config: this.config });
      issues[command.id] = result.issues;
      return result.command;
    });
    batch = { ...batch, commands: validated };

    // 5. Decision.
    const { decision, clarification } = this.decide(batch, language);
    return this.finish({ batch, decision, clarification, issues, language, usedLLM, usedContext, supersedesBatchId, started, llmMs, error, state: input.state, now });
  }

  private decide(batch: CommandBatch, language: Language): { decision: EngineDecision; clarification: Clarification | null } {
    const s = t(language);
    const unknown = batch.commands.every((c) => c.intent === 'UNKNOWN');
    if (unknown) {
      const first = batch.commands[0];
      return { decision: 'unknown', clarification: first ? { commandId: first.id, field: 'intent', question: s.unknown } : null };
    }
    for (const command of batch.commands) {
      if (command.intent === 'UNKNOWN') continue;
      if (command.missingFields.length > 0 && command.clarificationQuestion) {
        return { decision: 'clarify', clarification: { commandId: command.id, field: command.missingFields[0] ?? 'when', question: command.clarificationQuestion } };
      }
    }
    const minConfidence = maxConfidence(batch);
    if (minConfidence < this.config.thresholds.confirm) {
      const lowest = [...batch.commands].sort((a, b) => a.confidence - b.confidence)[0];
      return { decision: 'clarify', clarification: lowest ? { commandId: lowest.id, field: 'intent', question: lowest.intent === 'CAPTURE_NOTE' && lowest.warnings.includes('fallback') ? s.fallbackNote : s.lowConfidence } : null };
    }
    const allSafe = batch.commands.every((c) => isAutoExecutable(c, this.config.autoExecutableIntents));
    if (minConfidence >= this.config.thresholds.autoConfirm && allSafe && this.config.autoExecuteSafeCommands) {
      return { decision: 'execute', clarification: null };
    }
    return { decision: 'confirm', clarification: null };
  }

  private finish(params: {
    batch: CommandBatch | null;
    decision: EngineDecision;
    clarification?: Clarification | null;
    issues?: Record<string, ValidationIssue[]>;
    language: Language;
    usedLLM: boolean;
    usedContext: boolean;
    supersedesBatchId: string | null;
    started: number;
    llmMs: number | null;
    error: DomainError | null;
    state: ConversationState;
    now: DateTime;
  }): EngineOutput {
    const { batch, decision } = params;
    const clarification = params.clarification ?? null;
    const at = params.now.toISO() ?? new Date().toISOString();
    let state: ConversationState = params.state;
    if (batch && decision === 'clarify' && clarification) {
      state = { ...params.state, pending: { batch, commandId: clarification.commandId, field: clarification.field, question: clarification.question, createdAt: at }, lastBatch: params.state.lastBatch };
    } else if (batch && (decision === 'confirm' || decision === 'execute')) {
      state = { ...params.state, pending: null, lastBatch: { batch, status: 'proposed', at } };
    } else if (decision === 'unknown') {
      state = { ...params.state, pending: null };
    }
    const result: EngineResult = {
      batch,
      decision,
      clarification,
      issues: params.issues ?? {},
      usedLLM: params.usedLLM,
      usedContext: params.usedContext,
      supersedesBatchId: params.supersedesBatchId,
      language: params.language,
      timings: { totalMs: Date.now() - params.started, llmMs: params.llmMs },
      error: params.error,
    };
    return { result, state };
  }
}

/** Short summary used for LLM context and history rows. */
export function summarizeBatch(batch: CommandBatch): string {
  return batch.commands
    .map((c) => {
      switch (c.intent) {
        case 'CAPTURE_NOTE':
        case 'CAPTURE_IDEA':
        case 'CREATE_TASK':
        case 'CREATE_REMINDER':
        case 'CREATE_CALENDAR_EVENT':
          return `${c.intent}: ${c.title}${'when' in c && c.when?.date ? ` @ ${c.when.date}${c.when.time ? ` ${c.when.time}` : ''}` : ''}`;
        case 'CREATE_ALARM':
          return `${c.intent}: ${c.when?.date ?? ''} ${c.when?.time ?? ''}`.trim();
        case 'CREATE_TIMER':
          return `${c.intent}: ${c.durationSeconds ?? '?'}s`;
        case 'COMPLETE_TASK':
        case 'UPDATE_TASK':
        case 'UPDATE_EVENT':
        case 'DELETE_EVENT':
          return `${c.intent}: ${c.targetQuery}`;
        case 'SEARCH_NOTES':
          return `${c.intent}: ${c.query}`;
        case 'BUTLER_TOOL':
          return `${c.tool}: ${c.preview.title}`;
        default:
          return c.intent;
      }
    })
    .join(' | ');
}

function isExpiredAt(createdAt: string, now: DateTime, ttlMinutes: number): boolean {
  const dt = DateTime.fromISO(createdAt);
  return !dt.isValid || now.diff(dt, 'minutes').minutes > ttlMinutes;
}

/** Marks the last batch in the conversation state as executed or cancelled. */
export function markLastBatch(state: ConversationState, batchId: string, status: 'executed' | 'cancelled', now: DateTime = DateTime.now()): ConversationState {
  if (!state.lastBatch || state.lastBatch.batch.id !== batchId) return state;
  return { ...state, pending: null, lastBatch: { ...state.lastBatch, status, at: now.toISO() ?? new Date().toISOString() } };
}

export function newBatchId(): string {
  return newId();
}
