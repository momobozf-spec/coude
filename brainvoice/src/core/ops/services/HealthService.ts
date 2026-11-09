import { DateTime } from 'luxon';

import type { CostService } from './CostService';
import type { OutboxService } from './OutboxService';
import type { AIGateway } from '../../ai/AIGateway';
import type { Database } from '../../db/Database';
import type { OperatingMode, SystemHealth, WorkerHeartbeat } from '../../domain/ops';
import type { EmailProvider } from '../../email/EmailProvider';
import type { Clock } from '../../services/Clock';
import type { HomeAutomationProvider } from '../providers/HomeAutomationProvider';
import type { JobQueue } from '../queue/JobQueue';
import type { OpsSettings } from '../settings';

export interface HealthDeps {
  queue: JobQueue;
  outbox: OutboxService;
  costs: CostService;
  ai: AIGateway;
  emailProvider: () => EmailProvider;
  homeProvider: () => HomeAutomationProvider;
  settings: () => OpsSettings;
  /** A worker is considered gone after this silence (default 3 minutes). */
  heartbeatTtlMs?: number;
}

/**
 * System Health (§165) reports facts only. "Continuous" (24/7) is true solely when a
 * server-mode worker has sent a heartbeat recently; in-process workers count as
 * "while the app is open". Nothing here extrapolates.
 */
export class HealthService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly deps: HealthDeps,
  ) {}

  async check(): Promise<SystemHealth> {
    const now = this.clock.now();
    const ttl = this.deps.heartbeatTtlMs ?? 3 * 60_000;
    const workers = await this.db.workers.list();
    const isActive = (w: WorkerHeartbeat) => w.status !== 'stopped' && DateTime.fromISO(w.lastSeenAt).diff(now).as('milliseconds') > -ttl;
    const active = workers.filter(isActive);
    const stale = workers.filter((w) => !isActive(w));
    const serverActive = active.filter((w) => w.mode === 'server' && w.kind !== 'schedule');
    const inProcessActive = active.filter((w) => w.mode === 'in_process' && w.kind !== 'schedule');
    const schedulerAlive = active.some((w) => w.kind === 'schedule');
    const mode: OperatingMode = serverActive.length && inProcessActive.length ? 'mixed' : serverActive.length ? 'server' : inProcessActive.length ? 'in_process' : 'none';
    const continuous = serverActive.length > 0 && active.some((w) => w.kind === 'schedule' && w.mode === 'server');

    const [queue, retrying, tickets, approvalsPending, questionsOpen, outboxPending, schedules, lastPoll, lastBriefing, costToday] = await Promise.all([
      this.deps.queue.stats(),
      this.deps.queue.list({ statuses: ['queued', 'running'], limit: 50 }),
      this.db.tickets.countByStatus(),
      this.db.approvals.countPending(),
      this.db.questions.countOpen(),
      this.deps.outbox.pendingCount(),
      this.db.schedules.list({ enabledOnly: true }),
      this.db.jobs.lastFinishedOfType('email.poll'),
      this.db.briefings.latest(),
      this.deps.costs.today(),
    ]);
    const emailProvider = this.deps.emailProvider();
    const emailStatus = await emailProvider.status().catch(() => ({ state: 'error' as const, detail: 'status check failed' }));
    const emailCaps = emailProvider.capabilities();
    const homeProvider = this.deps.homeProvider();
    const homeConnected = await homeProvider.isConnected().catch(() => false);
    const settings = this.deps.settings();

    const warnings: string[] = [];
    if (mode === 'none') warnings.push('No worker is running: tickets wait until the app is open or the Alfred server runs.');
    else if (!continuous && serverActive.length) warnings.push('Server workers are alive but no server scheduler heartbeat was seen – scheduled work (polls, briefings, SLA pickup) is not running.');
    else if (!continuous) warnings.push('Workers run inside the app only while it is open – this is not 24/7 operation.');
    if (mode !== 'none' && !schedulerAlive) warnings.push('No scheduler heartbeat in the last 3 minutes.');
    if (stale.length) warnings.push(`${stale.length} worker(s) stopped reporting.`);
    if (queue.failed) warnings.push(`${queue.failed} failed job(s) need attention.`);
    // A job that failed and waits for its backoff is not "failed" yet, but the outage must be visible (e.g. a mailbox poll during a network problem).
    const retryingJobs = retrying.filter((j) => j.attempts > 0 && j.lastError);
    if (retryingJobs.length) {
      const first = retryingJobs[0]!;
      warnings.push(`${retryingJobs.length} job(s) retrying after an error – ${first.type}: ${first.lastError} (attempt ${first.attempts}/${first.maxAttempts}).`);
    }
    if (queue.oldestQueuedAt) {
      const ageMinutes = Math.round(now.diff(DateTime.fromISO(queue.oldestQueuedAt), 'minutes').minutes);
      if (ageMinutes > settings.pickupSlaMinutes * 2) warnings.push(`Oldest queued job is ${ageMinutes} min old (no worker picked it up).`);
    }
    if (!emailCaps.canList) warnings.push('No mailbox is monitored: emails arrive by paste or share only.');
    else if (emailStatus.state !== 'ready') warnings.push(`Email provider ${emailProvider.id}: ${emailStatus.detail ?? emailStatus.state}.`);
    if (!homeConnected) warnings.push('No home automation system connected.');
    if (!this.deps.ai.isAvailable()) warnings.push('Cloud AI is off: only deterministic work (no drafting with AI, no advisory analysis).');
    if (costToday.cents >= settings.dailyCostWarningCents) warnings.push(`Estimated AI cost today ${(costToday.cents / 100).toFixed(2)} EUR exceeds the warning level.`);

    return {
      checkedAt: this.clock.nowISO(),
      mode,
      continuous,
      schedulerAlive,
      workers,
      activeWorkers: active.length,
      staleWorkers: stale.length,
      queue: { queued: queue.queued, running: queue.running, failed: queue.failed, delayed: queue.delayed, oldestQueuedMinutes: queue.oldestQueuedAt ? Math.max(0, Math.round(now.diff(DateTime.fromISO(queue.oldestQueuedAt), 'minutes').minutes)) : null },
      tickets,
      approvalsPending,
      questionsOpen,
      outboxPending,
      schedulesEnabled: schedules.length,
      lastEmailPollAt: lastPoll?.finishedAt ?? null,
      lastBriefingAt: lastBriefing?.createdAt ?? null,
      email: { providerId: emailProvider.id, monitoring: emailCaps.canList && emailStatus.state === 'ready' && continuous, canSend: emailCaps.canSend && emailStatus.state === 'ready' },
      home: { providerId: homeProvider.id, connected: homeConnected },
      ai: { available: this.deps.ai.isAvailable() },
      costTodayCents: costToday.cents,
      warnings,
    };
  }
}
