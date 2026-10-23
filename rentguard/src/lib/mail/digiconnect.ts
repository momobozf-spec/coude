import 'server-only';

import { getEnv } from '@/lib/env';
import type {
  RegisteredMailProvider,
  RegisteredMailSendInput,
  RegisteredMailSendResult,
  RegisteredMailStatus,
  RegisteredMailStatusResult,
} from '@/lib/mail/provider';

/**
 * Adapter voor DigiConnect / Aangetekende.email.
 *
 * Gekozen omdat die als enige onderzochte partij zowel de zuiver elektronische
 * QERDS-route als de hybride route naar fysieke bpost-post aanbiedt. Zie
 * `docs/decisions/0001-aangetekende-zending-provider.md`.
 *
 * **Let op bij ingebruikname.** De precieze veldnamen van deze API konden in
 * fase 0 niet uit publieke documentatie bevestigd worden; ze staan hieronder op
 * één plek bij elkaar (`toProviderPayload`, `readProviderStatus`) zodat ze bij
 * het contract met de provider in één keer aangepast kunnen worden. Zolang er
 * geen credentials zijn, wordt deze adapter niet aangeroepen: de UI biedt hem
 * niet aan en `createRegisteredMailProvider` geeft null terug.
 */

const STATUS_MAP: Record<string, RegisteredMailStatus> = {
  pending: 'PENDING',
  queued: 'PENDING',
  sent: 'SENT',
  dispatched: 'SENT',
  delivered: 'DELIVERED',
  accepted: 'DELIVERED',
  refused: 'REFUSED',
  rejected: 'REFUSED',
  failed: 'FAILED',
  error: 'FAILED',
};

interface ProviderSendResponse {
  id?: string;
  reference?: string;
  status?: string;
  [key: string]: unknown;
}

interface ProviderStatusResponse {
  status?: string;
  delivered_at?: string;
  [key: string]: unknown;
}

export class DigiConnectProvider implements RegisteredMailProvider {
  readonly id = 'digiconnect';
  readonly channels = ['QERDS', 'HYBRID_POST'] as const;

  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly accountId: string,
  ) {}

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Account-Id': this.accountId,
    };
  }

  private toProviderPayload(input: RegisteredMailSendInput) {
    return {
      account_id: this.accountId,
      // QERDS = elektronisch aangetekend; HYBRID = afdrukken en fysiek
      // aangetekend bezorgen.
      delivery_type: input.channel === 'QERDS' ? 'qerds' : 'hybrid',
      client_reference: input.reference,
      subject: input.subject,
      sender: { name: input.senderName, address: input.senderAddress },
      recipient: {
        name: input.recipient.name,
        address: input.recipient.address,
        email: input.recipient.email,
      },
      document: {
        filename: input.fileName,
        content_type: 'application/pdf',
        content_base64: Buffer.from(input.pdf).toString('base64'),
      },
    };
  }

  private readProviderStatus(payload: ProviderStatusResponse): {
    status: RegisteredMailStatus;
    deliveredAt: string | null;
  } {
    const raw = (payload.status ?? '').toLowerCase();
    return {
      status: STATUS_MAP[raw] ?? 'UNKNOWN',
      deliveredAt: payload.delivered_at ?? null,
    };
  }

  async send(
    input: RegisteredMailSendInput,
  ): Promise<RegisteredMailSendResult> {
    if (!this.channels.includes(input.channel)) {
      return { ok: false, failure: 'CHANNEL_NOT_SUPPORTED' };
    }

    // Een fysieke aangetekende zending zonder adres is zinloos; een
    // elektronische zonder e-mailadres ook.
    if (!input.recipient.name.trim() || !input.recipient.address.trim()) {
      return { ok: false, failure: 'RECIPIENT_INCOMPLETE' };
    }
    if (input.channel === 'QERDS' && !input.recipient.email) {
      return { ok: false, failure: 'RECIPIENT_INCOMPLETE' };
    }

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/registered-mail`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.toProviderPayload(input)),
      });
    } catch {
      return { ok: false, failure: 'PROVIDER_UNREACHABLE' };
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return {
        ok: false,
        failure: 'PROVIDER_REJECTED',
        detail: detail.slice(0, 500),
      };
    }

    const payload = (await response
      .json()
      .catch(() => ({}))) as ProviderSendResponse;

    const providerReference = payload.id ?? payload.reference;
    if (!providerReference) {
      // Zonder referentie kunnen wij de zending later niet opvolgen; dan is er
      // geen bewijs en presenteren wij het niet als geslaagd.
      return { ok: false, failure: 'PROVIDER_REJECTED', detail: 'no reference' };
    }

    return { ok: true, providerReference, proof: payload };
  }

  async getStatus(
    providerReference: string,
  ): Promise<RegisteredMailStatusResult> {
    let response: Response;
    try {
      response = await fetch(
        `${this.apiUrl}/registered-mail/${encodeURIComponent(providerReference)}`,
        { headers: this.headers() },
      );
    } catch {
      return { ok: false, failure: 'PROVIDER_UNREACHABLE' };
    }

    if (!response.ok) {
      return { ok: false, failure: 'PROVIDER_REJECTED' };
    }

    const payload = (await response
      .json()
      .catch(() => ({}))) as ProviderStatusResponse;
    const { status, deliveredAt } = this.readProviderStatus(payload);

    return { ok: true, status, deliveredAt, proof: payload };
  }
}

export function createRegisteredMailProvider(): RegisteredMailProvider | null {
  const env = getEnv();

  if (
    env.REGISTERED_MAIL_PROVIDER !== 'digiconnect' ||
    !env.REGISTERED_MAIL_API_URL ||
    !env.REGISTERED_MAIL_API_KEY ||
    !env.REGISTERED_MAIL_ACCOUNT_ID
  ) {
    return null;
  }

  return new DigiConnectProvider(
    env.REGISTERED_MAIL_API_URL,
    env.REGISTERED_MAIL_API_KEY,
    env.REGISTERED_MAIL_ACCOUNT_ID,
  );
}
