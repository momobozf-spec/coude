import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { legalFooterLine } from '../config/legal-entity';

/** Getypte toegang tot de instellingen van de vergelijker. Eén plek, geen losse `config.get`-strings. */
@Injectable()
export class CompareConfig {
  constructor(private readonly config: ConfigService) {}

  get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  get feedDir(): string {
    return resolve(process.cwd(), this.config.get<string>('COMPARE_FEED_DIR') ?? 'data/feeds');
  }

  /** Standaard aan buiten productie, altijd uit in productie (afgedwongen in `env.ts`). */
  get allowDemo(): boolean {
    const explicit = this.config.get<boolean | undefined>('COMPARE_ALLOW_DEMO');
    if (explicit !== undefined) return explicit;
    return !this.isProduction;
  }

  /** Huidige en (tijdens rotatie) vorige jobsleutel. Leeg = interne endpoints bestaan niet. */
  get jobKeys(): readonly string[] {
    return [this.config.get<string>('COMPARE_JOB_KEY'), this.config.get<string>('COMPARE_JOB_KEY_PREVIOUS')].filter((key): key is string => !!key);
  }

  /** Grens voor één aangeleverde feed (`POST /compare/internal/feeds/:chain`), in bytes. */
  get feedPushMaxBytes(): number {
    return (this.config.get<number>('COMPARE_FEED_PUSH_MAX_MB') ?? 15) * 1024 * 1024;
  }

  get freshHours(): number {
    return this.config.get<number>('COMPARE_PRICE_FRESH_HOURS') ?? 48;
  }

  get syncIntervalMinutes(): number {
    return this.config.get<number>('COMPARE_SYNC_INTERVAL_MINUTES') ?? 0;
  }

  get syncLeaseMinutes(): number {
    return this.config.get<number>('COMPARE_SYNC_LEASE_MINUTES') ?? 20;
  }

  get adapterTimeoutMs(): number {
    return this.config.get<number>('COMPARE_ADAPTER_TIMEOUT_MS') ?? 60_000;
  }

  /** E-mail is pas "aan" met een echt transport én de vlag. */
  get emailEnabled(): boolean {
    return (this.config.get<boolean>('NOTIFY_EMAIL_ENABLED') ?? false) && this.emailProvider !== 'none';
  }

  get emailProvider(): 'none' | 'file' | 'http' {
    return this.config.get<'none' | 'file' | 'http'>('EMAIL_PROVIDER') ?? 'none';
  }

  get emailFrom(): string | null {
    return this.config.get<string>('EMAIL_FROM') ?? null;
  }

  get emailHttpUrl(): string | null {
    return this.config.get<string>('EMAIL_HTTP_URL') ?? null;
  }

  get emailApiKey(): string | null {
    return this.config.get<string>('EMAIL_API_KEY') ?? null;
  }

  get emailOutboxDir(): string {
    return resolve(process.cwd(), this.config.get<string>('EMAIL_OUTBOX_DIR') ?? 'data/outbox');
  }

  get appUrl(): string {
    return this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  /** Afzenderregel onderaan e-mails: uitbater, ondernemingsnummer, adres (`LEGAL_ENTITY_ADDRESS`). */
  get legalFooter(): string {
    return legalFooterLine(this.config.get<string>('LEGAL_ENTITY_ADDRESS'));
  }

  /** Origin van de Superette-app, voor links in meldingen. */
  get webUrl(): string {
    return this.config.get<string>('SUPERETTE_WEB_URL') ?? 'http://localhost:3001';
  }
}
