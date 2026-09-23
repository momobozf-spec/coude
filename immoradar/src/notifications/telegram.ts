import { createLogger } from "@/lib/logger";
import { getEnv } from "@/lib/env";

export interface AlertTransport {
  readonly name: string;
  send(chatId: string, text: string): Promise<{ ok: boolean; error?: string }>;
}

const log = createLogger({ component: "telegram" });

/** Real Telegram Bot API transport. */
export class TelegramTransport implements AlertTransport {
  readonly name = "telegram";
  constructor(private readonly token: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async send(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `Telegram API ${res.status}: ${body.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Console transport for local development: logs instead of sending. Chat ids are never logged. */
export class ConsoleTransport implements AlertTransport {
  readonly name = "console";
  async send(_chatId: string, text: string): Promise<{ ok: boolean }> {
    log.info("telegram message (console transport)", { preview: text.slice(0, 120).replace(/\n/g, " | ") });
    return { ok: true };
  }
}

/** In-memory transport for tests. */
export class MemoryTransport implements AlertTransport {
  readonly name = "memory";
  readonly sent: Array<{ chatId: string; text: string }> = [];
  failNext = false;
  async send(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, error: "simulated failure" };
    }
    this.sent.push({ chatId, text });
    return { ok: true };
  }
}

export function defaultTransport(): AlertTransport {
  const token = getEnv().TELEGRAM_BOT_TOKEN;
  return token ? new TelegramTransport(token) : new ConsoleTransport();
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
