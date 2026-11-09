import type { AutonomyLevel } from '../domain/ops';

/** Operations settings stored under `app.settings.ops` (§168). */
export interface OpsSettings {
  autonomy: AutonomyLevel;
  /** INBOX tickets are picked up automatically after this many minutes. */
  pickupSlaMinutes: number;
  /** Local time (HH:mm) of the morning briefing / evening review. */
  briefingTime: string;
  eveningTime: string;
  emailPollMinutes: number;
  /** Run workers inside the app while it is open (best effort, never 24/7). */
  inProcessWorkers: boolean;
  /** Base URL of a deployed Alfred server; empty = local only. */
  serverUrl: string;
  /** Approvals and questions expire after this many days (ticket becomes BLOCKED). */
  approvalExpiryDays: number;
  /** Daily estimated AI cost ceiling in cents for warnings (never blocks work). */
  dailyCostWarningCents: number;
}

export const DEFAULT_OPS_SETTINGS: OpsSettings = {
  autonomy: 'PROACTIVE',
  pickupSlaMinutes: 30,
  briefingTime: '08:00',
  eveningTime: '18:00',
  emailPollMinutes: 15,
  inProcessWorkers: true,
  serverUrl: '',
  approvalExpiryDays: 7,
  dailyCostWarningCents: 500,
};

/**
 * Which tool permissions a worker may execute without a durable approval, per autonomy
 * level. Sensitive and external tools always need an approval ("nothing important
 * happens without my approval"); the levels only differ for local writes.
 */
export function permissionNeedsApproval(permission: 'read' | 'write' | 'sensitive' | 'external', autonomy: AutonomyLevel): boolean {
  if (permission === 'read') return false;
  if (permission === 'write') return autonomy === 'ASSISTANT';
  return true;
}

/** Whether Alfred may open tickets on his own initiative (email triage, CRM scans, night shift). */
export function mayCreateTicketsProactively(autonomy: AutonomyLevel): boolean {
  return autonomy === 'OPERATOR';
}
