import type { AssistantIntent } from './schema';

/**
 * Engine thresholds and behaviour flags. All values are user-configurable
 * through the Settings screen (see SettingsService) and injected at runtime.
 */
export interface EngineThresholds {
  /** ≥ this: safe intents may auto-execute when the user enabled it. */
  autoConfirm: number;
  /** ≥ this (and < autoConfirm): show interpretation and ask for confirmation. */
  confirm: number;
  /** below `confirm`: ask a clarification question. */
}

export interface EngineConfig {
  thresholds: EngineThresholds;
  /** Auto-execute safe, high-confidence commands without showing the preview first. Off by default. */
  autoExecuteSafeCommands: boolean;
  /** Intents that may auto-execute at all (subset of SAFE_INTENTS). */
  autoExecutableIntents: AssistantIntent[];
  /** Use the LLM parser when the deterministic parser fails or is unsure. */
  llmEnabled: boolean;
  /** Deterministic results below this confidence are second-guessed by the LLM (if enabled). */
  llmFallbackBelow: number;
  /** Default calendar event length when no end time or duration was given. */
  defaultEventDurationMinutes: number;
  /** Time used for reminders that only have a day part ("tomorrow morning"). */
  defaultReminderTime: string;
  /** Minutes the conversation context stays valid for follow-ups ("make that 3 instead"). */
  contextTtlMinutes: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  thresholds: { autoConfirm: 0.9, confirm: 0.65 },
  autoExecuteSafeCommands: false,
  autoExecutableIntents: ['CAPTURE_NOTE', 'CAPTURE_IDEA', 'CREATE_TASK', 'CREATE_TIMER', 'SEARCH_NOTES', 'GET_AGENDA', 'GET_TASKS'],
  llmEnabled: false,
  llmFallbackBelow: 0.85,
  defaultEventDurationMinutes: 60,
  defaultReminderTime: '09:00',
  contextTtlMinutes: 10,
};
