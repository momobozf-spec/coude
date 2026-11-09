/**
 * Telegram Bot API.
 *
 * Klein met opzet: één methode (`sendMessage`), want dat is alles wat de dienst
 * doet. Een SDK zou hier meer afhankelijkheid dan waarde toevoegen.
 *
 * ─── DRY-RUN ────────────────────────────────────────────────────────────────
 *
 * Zonder `TELEGRAM_BOT_TOKEN` verstuurt de client niets en meldt hij dat als
 * `dryRun`. Dat is geen stub: de alert wordt gewoon aangemaakt en gelogd met
 * status SUPPRESSED_DRY_RUN, zodat de volledige pijplijn — inclusief
 * deduplicatie van meldingen — lokaal te draaien en te controleren is zonder
 * een bot aan te maken.
 */
import { NotificationError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ component: 'telegram' })

const TELEGRAM_API_BASE = 'https://api.telegram.org'

export interface SendResult {
  ok: boolean
  dryRun: boolean
  messageId: string | null
  error: string | null
  /** Bij een 429: hoeveel seconden Telegram vraagt te wachten. */
  retryAfterSeconds: number | null
}

interface TelegramResponse {
  ok: boolean
  result?: { message_id?: number }
  description?: string
  error_code?: number
  parameters?: { retry_after?: number }
}

export interface TelegramClientOptions {
  botToken: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export class TelegramClient {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(private readonly options: TelegramClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 10_000
  }

  get enabled(): boolean {
    return this.options.botToken.length > 0
  }

  async sendMessage(chatId: string, text: string): Promise<SendResult> {
    if (!this.enabled) {
      logger.info('Telegram staat in dry-run: bericht niet verstuurd', { textLength: text.length })
      return { ok: true, dryRun: true, messageId: null, error: null, retryAfterSeconds: null }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchImpl(
        `${TELEGRAM_API_BASE}/bot${this.options.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            // HTML boven MarkdownV2: adresvelden zitten vol met tekens die
            // MarkdownV2 wil geëscaped hebben, en één gemiste escape maakt het
            // hele bericht ongeldig. Bij HTML zijn het er drie (&, <, >).
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
          signal: controller.signal,
        },
      )

      const payload = (await response.json()) as TelegramResponse

      if (!response.ok || !payload.ok) {
        const retryAfter = payload.parameters?.retry_after ?? null
        const description = payload.description ?? `HTTP ${response.status}`

        return {
          ok: false,
          dryRun: false,
          messageId: null,
          error: description,
          retryAfterSeconds: retryAfter,
        }
      }

      return {
        ok: true,
        dryRun: false,
        messageId: payload.result?.message_id ? String(payload.result.message_id) : null,
        error: null,
        retryAfterSeconds: null,
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NotificationError(`Telegram antwoordde niet binnen ${this.timeoutMs} ms`, true)
      }
      throw new NotificationError(
        `Telegram onbereikbaar: ${error instanceof Error ? error.message : String(error)}`,
        true,
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
