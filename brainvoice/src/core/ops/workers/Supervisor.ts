import type { Worker } from './Worker';
import type { Logger } from '../../logging/logger';
import type { ScheduleService } from '../services/ScheduleService';

export interface SupervisorOptions {
  workers: Worker[];
  /** The scheduler tick runs before the workers; null for worker-only processes. */
  scheduler: ScheduleService | null;
  pollMs: number;
  /** Jobs per worker per tick. */
  jobsPerTick?: number;
  /** Called after every scheduler tick (heartbeat for System Health). */
  onSchedulerTick?: () => Promise<void>;
  /** Called at the start of every tick (e.g. reload settings changed by another process). */
  beforeTick?: () => Promise<void>;
  logger?: Logger;
}

/**
 * Runs the scheduler tick and the workers on an interval. Hosts own the lifecycle: the
 * Node server keeps it running (24/7 when deployed); the app runs it only while open and
 * reports that honestly in System Health.
 */
export class WorkerSupervisor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private stopped = false;

  constructor(private readonly options: SupervisorOptions) {}

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    for (const worker of this.options.workers) worker.resume();
    this.timer = setInterval(() => void this.tick(), this.options.pollMs);
    void this.tick();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const worker of this.options.workers) await worker.stop();
  }

  /** One pass: schedules → workers. Safe to call manually (tests, "run now" button). */
  async tick(): Promise<{ scheduled: number; processed: number }> {
    if (this.ticking || this.stopped) return { scheduled: 0, processed: 0 };
    this.ticking = true;
    let scheduled = 0;
    let processed = 0;
    try {
      await this.options.beforeTick?.();
      if (this.options.scheduler) {
        const result = await this.options.scheduler.tick();
        scheduled = result.enqueued.length;
        await this.options.onSchedulerTick?.();
      }
      for (const worker of this.options.workers) processed += await worker.drain(this.options.jobsPerTick ?? 10);
    } catch (e) {
      this.options.logger?.error('supervisor tick failed', { message: e instanceof Error ? e.message : String(e) });
    } finally {
      this.ticking = false;
    }
    return { scheduled, processed };
  }
}
