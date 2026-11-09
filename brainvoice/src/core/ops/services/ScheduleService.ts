import type { Database } from '../../db/Database';
import type { Schedule, ScheduleSpec } from '../../domain/ops';
import type { Logger } from '../../logging/logger';
import type { Clock } from '../../services/Clock';
import { DomainError, type Language } from '../../types/common';
import { newId } from '../../util/id';
import type { JobQueue } from '../queue/JobQueue';
import { parseAutomationText, type AutomationPreview } from '../schedule/automationParser';
import { computeNextRun, describeSpec } from '../schedule/nextRun';
import type { OpsSettings } from '../settings';

export const JOB_TICKET_CREATE = 'ticket.create';

export interface ScheduleInput {
  name: string;
  spec: ScheduleSpec;
  timezone?: string | null;
  jobType: string;
  payload?: Record<string, unknown>;
  enabled?: boolean;
  maxAttempts?: number;
  sourceText?: string | null;
}

/**
 * Scheduler (§164): one-time, delayed, interval, daily/weekly and cron schedules. A tick
 * enqueues due jobs with an idempotency key derived from the planned run moment, then
 * advances `next_run_at` with a compare-and-set, so two scheduler processes never
 * double-fire. Missed runs (device off for days) fire once, not once per missed slot.
 */
export class ScheduleService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly queue: JobQueue,
    private readonly language: () => Language,
    private readonly logger?: Logger,
    private readonly settings?: () => OpsSettings,
  ) {}

  /** Applies the user's briefing times and mailbox interval to the built-in schedules (§156, §160, §168). */
  async syncBuiltIns(): Promise<string[]> {
    if (!this.settings) return [];
    const s = this.settings();
    const wanted: Record<string, ScheduleSpec> = {
      sched_morning_briefing: { kind: 'daily', at: /^\d{2}:\d{2}$/.test(s.briefingTime) ? s.briefingTime : '08:00' },
      sched_evening_review: { kind: 'daily', at: /^\d{2}:\d{2}$/.test(s.eveningTime) ? s.eveningTime : '18:00' },
      sched_email_poll: { kind: 'interval', everyMinutes: Math.max(1, Math.round(s.emailPollMinutes || 15)) },
    };
    const changed: string[] = [];
    for (const [id, spec] of Object.entries(wanted)) {
      const schedule = await this.db.schedules.getById(id);
      if (!schedule || JSON.stringify(schedule.spec) === JSON.stringify(spec)) continue;
      await this.update(id, { spec });
      changed.push(id);
    }
    return changed;
  }

  list(enabledOnly = false): Promise<Schedule[]> {
    return this.db.schedules.list({ enabledOnly });
  }

  get(id: string): Promise<Schedule | null> {
    return this.db.schedules.getById(id);
  }

  async require(id: string): Promise<Schedule> {
    const schedule = await this.db.schedules.getById(id);
    if (!schedule) throw new DomainError('NOT_FOUND', `Schedule ${id} not found`);
    return schedule;
  }

  zoneOf(schedule: Pick<Schedule, 'timezone'>): string {
    return schedule.timezone ?? this.clock.timezone();
  }

  async create(input: ScheduleInput): Promise<Schedule> {
    const nowISO = this.clock.nowISO();
    const zone = input.timezone ?? this.clock.timezone();
    const next = computeNextRun(input.spec, this.clock.now(), zone);
    if (input.spec.kind === 'cron' && !next) throw new DomainError('VALIDATION_FAILED', `Invalid cron expression: ${input.spec.cron ?? ''}`);
    const schedule: Schedule = {
      id: newId(),
      name: input.name.trim(),
      spec: input.spec,
      timezone: input.timezone ?? null,
      jobType: input.jobType,
      payload: input.payload ?? {},
      enabled: input.enabled ?? true,
      builtIn: false,
      nextRunAt: next?.toISO({ suppressMilliseconds: true }) ?? null,
      lastRunAt: null,
      lastJobId: null,
      maxAttempts: input.maxAttempts ?? 3,
      sourceText: input.sourceText ?? null,
      createdAt: nowISO,
      updatedAt: nowISO,
    };
    if (!schedule.name) throw new DomainError('VALIDATION_FAILED', 'A schedule needs a name');
    await this.db.schedules.insert(schedule);
    return schedule;
  }

  async update(id: string, patch: Partial<Pick<ScheduleInput, 'name' | 'spec' | 'timezone' | 'payload' | 'maxAttempts' | 'sourceText'>>): Promise<Schedule> {
    const schedule = await this.require(id);
    const next: Schedule = { ...schedule, ...patch, timezone: patch.timezone === undefined ? schedule.timezone : patch.timezone, updatedAt: this.clock.nowISO() };
    if (patch.spec || patch.timezone !== undefined) next.nextRunAt = computeNextRun(next.spec, this.clock.now(), this.zoneOf(next))?.toISO({ suppressMilliseconds: true }) ?? null;
    await this.db.schedules.update(next);
    return next;
  }

  async setEnabled(id: string, enabled: boolean): Promise<Schedule> {
    const schedule = await this.require(id);
    const next: Schedule = { ...schedule, enabled, updatedAt: this.clock.nowISO() };
    if (enabled && !next.nextRunAt) next.nextRunAt = computeNextRun(next.spec, this.clock.now(), this.zoneOf(next))?.toISO({ suppressMilliseconds: true }) ?? null;
    await this.db.schedules.update(next);
    return next;
  }

  async delete(id: string): Promise<void> {
    const schedule = await this.require(id);
    if (schedule.builtIn) throw new DomainError('VALIDATION_FAILED', 'Built-in schedules can be disabled, not deleted');
    await this.db.schedules.delete(id);
  }

  describe(schedule: Schedule, language: Language = this.language()): string {
    return describeSpec(schedule.spec, language);
  }

  /** Enqueues every due schedule once. Returns what was enqueued (for logs and tests). */
  async tick(): Promise<{ enqueued: { scheduleId: string; jobId: string; firedFor: string }[]; initialised: string[] }> {
    await this.syncBuiltIns().catch((e: unknown) => this.logger?.warn('built-in schedule sync failed', { message: e instanceof Error ? e.message : String(e) }));
    const now = this.clock.now();
    const nowISO = this.clock.nowISO();
    const enqueued: { scheduleId: string; jobId: string; firedFor: string }[] = [];
    const initialised: string[] = [];
    for (const schedule of await this.db.schedules.listDue(nowISO)) {
      const zone = this.zoneOf(schedule);
      let firedFor = schedule.nextRunAt;
      if (!firedFor) {
        // First evaluation: interval schedules run right away, time-of-day schedules wait for their slot.
        const immediate = schedule.spec.kind === 'interval' || (schedule.spec.kind === 'once' && schedule.spec.runAt !== undefined && schedule.spec.runAt <= nowISO);
        if (!immediate) {
          const next = computeNextRun(schedule.spec, now, zone);
          await this.db.schedules.setNextRun(schedule.id, next?.toISO({ suppressMilliseconds: true }) ?? null, nowISO);
          if (!next) await this.db.schedules.update({ ...schedule, enabled: false, updatedAt: nowISO });
          initialised.push(schedule.id);
          continue;
        }
        firedFor = nowISO;
      }
      try {
        const { job } = await this.queue.enqueue({
          type: schedule.jobType,
          payload: { ...schedule.payload, scheduleId: schedule.id, scheduledFor: firedFor },
          idempotencyKey: `schedule:${schedule.id}:${firedFor}`,
          scheduleId: schedule.id,
          maxAttempts: schedule.maxAttempts,
        });
        const next = schedule.spec.kind === 'once' ? null : computeNextRun(schedule.spec, now, zone);
        const advanced = await this.db.schedules.advance(schedule.id, schedule.nextRunAt, { nextRunAt: next?.toISO({ suppressMilliseconds: true }) ?? null, lastRunAt: nowISO, lastJobId: job.id, nowISO });
        if (!advanced) continue; // another scheduler instance advanced it first; the idempotent enqueue returned its job
        if (schedule.spec.kind === 'once') await this.db.schedules.update({ ...schedule, enabled: false, nextRunAt: null, lastRunAt: nowISO, lastJobId: job.id, updatedAt: nowISO });
        enqueued.push({ scheduleId: schedule.id, jobId: job.id, firedFor });
      } catch (e) {
        this.logger?.warn('schedule tick failed', { scheduleId: schedule.id, message: e instanceof Error ? e.message : String(e) });
      }
    }
    return { enqueued, initialised };
  }

  // ---------------------------------------------------------------------------
  // Natural-language automations (§163)
  // ---------------------------------------------------------------------------

  parseAutomation(text: string, language: Language = this.language()): AutomationPreview | null {
    return parseAutomationText(text, language, this.clock.now(), this.clock.timezone());
  }

  /** Activates a previewed automation: every run creates a ticket with the request text. */
  activate(preview: AutomationPreview, options: { priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' } = {}): Promise<Schedule> {
    return this.create({
      name: preview.name,
      spec: preview.spec,
      timezone: preview.timezone,
      jobType: JOB_TICKET_CREATE,
      payload: { text: preview.action, title: preview.name, priority: options.priority ?? 'NORMAL' },
      sourceText: preview.sourceText,
    });
  }
}
