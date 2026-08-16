/**
 * Telegram Bot API client. When TELEGRAM_BOT_TOKEN is not configured the
 * client runs in log-only mode: alerts are persisted and shown in-app, but
 * nothing leaves the system. Never logs chat message contents.
 */

import { env } from "@/lib/config";
import { logger } from "@/lib/logger";

export interface TelegramSendResult {
  ok: boolean;
  delivered: boolean;
  error: string | null;
}

export interface TelegramClient {
  sendMessage(chatId: string, text: string): Promise<TelegramSendResult>;
}

export class HttpTelegramClient implements TelegramClient {
  constructor(private readonly token: string) {}

  async sendMessage(chatId: string, text: string): Promise<TelegramSendResult> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const body = await response.text();
        logger.warn("telegram.send_failed", { status: response.status });
        return { ok: false, delivered: false, error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true, delivered: true, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn("telegram.send_error", { error: message });
      return { ok: false, delivered: false, error: message };
    }
  }
}

export class NoopTelegramClient implements TelegramClient {
  sendMessage(): Promise<TelegramSendResult> {
    logger.info("telegram.disabled_skipping_send");
    return Promise.resolve({ ok: true, delivered: false, error: null });
  }
}

export function telegramClient(): TelegramClient {
  const token = env().TELEGRAM_BOT_TOKEN;
  if (!token) return new NoopTelegramClient();
  return new HttpTelegramClient(token);
}
