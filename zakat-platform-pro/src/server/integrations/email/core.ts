import { z } from 'zod'

/**
 * Uitgaande e-mail.
 *
 * Twee implementaties: Resend (productie) en `none`. `none` verstuurt niets en
 * zegt dat ook (`delivered: false`) — een herstelmail die "verstuurd" lijkt maar
 * nergens aankomt is erger dan een eerlijke foutmelding. Buiten productie logt
 * `none` het bericht, zodat je de herstellink lokaal kunt volgen.
 */

export interface EmailMessage {
  to: string
  subject: string
  text: string
}

export interface EmailResult {
  delivered: boolean
  providerId?: string
  error?: string
}

export interface EmailSender {
  readonly name: 'resend' | 'none'
  send(message: EmailMessage): Promise<EmailResult>
}

const resendResponse = z.object({ id: z.string() })

export const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** Resend REST API: `POST /emails` met Bearer-sleutel; antwoord `{ id }`. */
export class ResendEmailSender implements EmailSender {
  readonly name = 'resend' as const

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const response = await this.fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      if (!response.ok) {
        return { delivered: false, error: `Resend antwoordde ${response.status}` }
      }

      const parsed = resendResponse.safeParse(await response.json().catch(() => null))
      if (!parsed.success) return { delivered: false, error: 'Onverwacht antwoord van Resend' }
      return { delivered: true, providerId: parsed.data.id }
    } catch (error) {
      return {
        delivered: false,
        error: error instanceof Error ? error.message : 'onbekende fout',
      }
    }
  }
}

export class NoEmailSender implements EmailSender {
  readonly name = 'none' as const

  constructor(private readonly log?: (message: EmailMessage) => void) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    this.log?.(message)
    return { delivered: false, error: 'E-mail is niet geconfigureerd (EMAIL_PROVIDER=none).' }
  }
}
