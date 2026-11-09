/**
 * De logger.
 *
 * De redactielijst staat hier en niet bij de call-sites. Dat is het hele punt:
 * zolang niemand een eigen logger aanmaakt, is het onmogelijk om per ongeluk
 * een API-key of bot-token in de logs te krijgen — ook niet als iemand
 * `logger.info({ err })` doet op een fout die de request-headers bij zich draagt.
 */
import { pino } from "pino";
import { env } from "../config/env.js";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "headers.authorization",
  "config.headers.Authorization",
  "*.apiKey",
  "*.api_key",
  "*.token",
  "*.accessToken",
  "*.password",
  "*.secret",
  "apiKey",
  "token",
  "password",
  "DATABASE_URL",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "RESEND_API_KEY",
  "SMTP_PASSWORD",
  "WEBHOOK_SIGNING_SECRET",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  base: { service: "huiszoeker" },
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" },
        },
      }
    : {}),
});

export type Logger = typeof logger;
