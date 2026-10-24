/**
 * De periodieke verwerking, in één opnieuw uitvoerbare stap:
 *
 *  1. importeren (adapters → database, met normalisatie en matching);
 *  2. verlopen aanbiedingen deactiveren;
 *  3. actieve alerts controleren en meldingen klaarzetten;
 *  4. meldingen idempotent versturen;
 *  5. verlopen sessies opruimen.
 *
 * ## Nooit twee tegelijk
 *
 * Een lease in de database (`JobLease`) garandeert dat hoogstens één proces —
 * op welke machine ook — synchroniseert. Een tweede aanroep krijgt een 409.
 * De lease wordt tijdens de run verlengd en na afloop vrijgegeven; crasht het
 * proces, dan verloopt hij vanzelf na `COMPARE_SYNC_LEASE_MINUTES`.
 *
 * De interne planner (`COMPARE_SYNC_INTERVAL_MINUTES`) is er voor één proces;
 * met een aparte worker of externe cron zet je hem op 0.
 */
import { ConflictException, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AlertsService, type AlertCheckSummary } from '../alerts/alerts.service';
import { CompareConfig } from '../compare-config';
import { ImportService, type ImportRunSummary } from '../import/import.service';
import { NotificationDispatcherService, type DispatchSummary } from '../notifications/notification-dispatcher.service';
import { SessionsService } from '../../auth/sessions.service';
import { JobLeaseService, SYNC_LEASE_NAME } from './job-lease.service';

export interface SyncSummary {
  readonly runId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly imports: ImportRunSummary[];
  readonly expiredOffers: number;
  readonly alerts: AlertCheckSummary;
  readonly notifications: DispatchSummary;
  readonly purgedSessions: number;
  /** Mislukte adapters; de rest van de run ging gewoon door. */
  readonly failedAdapters: string[];
}

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private readonly holder = JobLeaseService.newHolderId();
  private running = false;
  /** Elke run krijgt een eigen houder-id, zodat de lease nooit per ongeluk "van onszelf" lijkt. */
  private runCounter = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly imports: ImportService,
    private readonly alerts: AlertsService,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly sessions: SessionsService,
    private readonly leases: JobLeaseService,
    private readonly config: CompareConfig,
  ) {}

  onModuleInit(): void {
    const minutes = this.config.syncIntervalMinutes;
    if (minutes <= 0) return;

    this.timer = setInterval(() => {
      void this.runSync({ trigger: 'scheduler' }).catch((error) => {
        if (error instanceof ConflictException) return; // een ander proces is bezig
        this.logger.error(`Geplande synchronisatie mislukt: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, minutes * 60_000);
    this.timer.unref();
    this.logger.log(`Interne planner actief: elke ${minutes} min een synchronisatie`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Eén volledige synchronisatie. Weigert met 409 als een ander proces de
   * lease houdt. Elke stap is idempotent; een gedeeltelijke mislukking laat
   * geldige gegevens staan (zie `ImportService`).
   */
  async runSync(options: { keys?: readonly string[]; trigger?: string; requestId?: string } = {}, now: Date = new Date()): Promise<SyncSummary> {
    const leaseMs = this.config.syncLeaseMinutes * 60_000;

    // Eerst de procesvlag (synchroon, vóór de eerste await), dan de databaselease.
    // Twee gelijktijdige verzoeken in hetzelfde proces delen anders dezelfde
    // houder-id en zouden de lease allebei "verlengen".
    if (this.running) {
      throw new ConflictException({ message: 'Er loopt al een synchronisatie', code: 'SYNC_ALREADY_RUNNING' });
    }
    this.running = true;
    const holder = `${this.holder}:${++this.runCounter}`;
    if (!(await this.leases.acquire(SYNC_LEASE_NAME, holder, leaseMs, now).catch((error: unknown) => { this.running = false; throw error; }))) {
      this.running = false;
      throw new ConflictException({ message: 'Er loopt al een synchronisatie', code: 'SYNC_ALREADY_RUNNING' });
    }

    const runId = `${now.toISOString()}:${holder}`;
    const startedAt = Date.now();
    const heartbeat = setInterval(() => {
      void this.leases.renew(SYNC_LEASE_NAME, holder, leaseMs).catch(() => undefined);
    }, Math.max(5_000, leaseMs / 3));
    heartbeat.unref();

    this.logger.log(`sync gestart trigger=${options.trigger ?? 'manual'} requestId=${options.requestId ?? '-'} adapters=${options.keys?.join(',') || 'alle'}`);

    try {
      const imports = await this.imports.runAll(options.keys ?? [], now);
      const expiredOffers = await this.imports.expireOffers(now);
      const alerts = await this.alerts.checkAll(now);
      const notifications = await this.dispatcher.dispatchPending(now);
      const purgedSessions = await this.sessions.purge(now);

      const summary: SyncSummary = {
        runId,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        imports,
        expiredOffers,
        alerts,
        notifications,
        purgedSessions,
        failedAdapters: imports.filter((run) => run.status === 'FAILED').map((run) => run.adapterKey),
      };

      this.logger.log(
        `sync klaar in ${summary.durationMs} ms · ${imports.length} adapters (${summary.failedAdapters.length} mislukt) · ${expiredOffers} verlopen · ${alerts.triggered} alerts · ${notifications.sent} meldingen · ${purgedSessions} sessies opgeruimd`,
      );
      return summary;
    } catch (error) {
      this.logger.error(`sync mislukt na ${Date.now() - startedAt} ms: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      clearInterval(heartbeat);
      this.running = false;
      await this.leases.release(SYNC_LEASE_NAME, holder).catch(() => undefined);
    }
  }
}
