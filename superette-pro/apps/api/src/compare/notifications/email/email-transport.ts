/**
 * E-mailtransport: de naad naar een provider.
 *
 *   none  — geen provider; de dispatcher registreert EMAIL_UNAVAILABLE en doet
 *           nooit alsof er iets verstuurd is;
 *   file  — schrijft elke mail als JSON in een lokale outbox (sandbox, tests);
 *   http  — generieke JSON-API met Bearer-sleutel (Resend-compatibel formaat;
 *           pas `HttpEmailTransport.payload` aan voor een andere provider).
 *
 * Geen provider is hardgecodeerd; alles komt uit de omgeving. De sleutel
 * verlaat dit bestand nooit (niet in logs, niet in fouten).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { CompareConfig } from '../../compare-config';

export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  /** Dezelfde mail nooit twee keer: de provider mag hierop ontdubbelen. */
  readonly idempotencyKey: string;
}

export type EmailSendResult =
  | { readonly status: 'SENT'; readonly providerId: string | null }
  | { readonly status: 'UNAVAILABLE'; readonly reason: string }
  /** `permanent: true` = niet opnieuw proberen (bv. 4xx van de provider). */
  | { readonly status: 'FAILED'; readonly error: string; readonly permanent: boolean };

export interface EmailTransport {
  readonly kind: 'none' | 'file' | 'http';
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export class NoopEmailTransport implements EmailTransport {
  readonly kind = 'none' as const;
  send(): Promise<EmailSendResult> {
    return Promise.resolve({ status: 'UNAVAILABLE', reason: 'EMAIL_UNAVAILABLE: geen e-mailprovider geconfigureerd (EMAIL_PROVIDER=none)' });
  }
}

/** Lokale outbox: één JSON-bestand per mail. Voor ontwikkeling en tests, nooit voor productie. */
export class FileEmailTransport implements EmailTransport {
  readonly kind = 'file' as const;

  constructor(
    private readonly directory: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    await mkdir(this.directory, { recursive: true });
    const safeKey = message.idempotencyKey.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
    const path = join(this.directory, `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeKey}.json`);
    await writeFile(path, JSON.stringify({ from: this.from, ...message }, null, 2), 'utf8');
    return { status: 'SENT', providerId: path };
  }
}

/** Generieke HTTP-provider. Time-out van 10 s; 4xx is permanent, 5xx/netwerk is tijdelijk. */
export class HttpEmailTransport implements EmailTransport {
  readonly kind = 'http' as const;
  private readonly logger = new Logger(HttpEmailTransport.name);

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  protected payload(message: EmailMessage): Record<string, unknown> {
    return {
      from: this.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: { 'X-Entity-Ref-ID': message.idempotencyKey },
    };
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
          'idempotency-key': message.idempotencyKey,
        },
        body: JSON.stringify(this.payload(message)),
        signal: controller.signal,
      });

      if (response.ok) {
        const body = (await response.json().catch(() => null)) as { id?: string } | null;
        return { status: 'SENT', providerId: body?.id ?? null };
      }

      const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
      this.logger.warn(`e-mailprovider antwoordde ${response.status} (${permanent ? 'permanent' : 'tijdelijk'})`);
      return { status: 'FAILED', error: `provider status ${response.status}`, permanent };
    } catch (error) {
      const reason = error instanceof Error && error.name === 'AbortError' ? 'time-out' : 'netwerkfout';
      return { status: 'FAILED', error: reason, permanent: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createEmailTransport(config: CompareConfig): EmailTransport {
  switch (config.emailProvider) {
    case 'file':
      return new FileEmailTransport(config.emailOutboxDir, config.emailFrom ?? 'Superette <noreply@localhost>');
    case 'http':
      if (!config.emailHttpUrl || !config.emailApiKey || !config.emailFrom) return new NoopEmailTransport();
      return new HttpEmailTransport(config.emailHttpUrl, config.emailApiKey, config.emailFrom);
    default:
      return new NoopEmailTransport();
  }
}
