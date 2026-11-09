/**
 * `DATABASE_URL` uit het `.env`-bestand in de hoofdmap lezen als hij nog niet
 * in de omgeving staat. Zo hoeft niemand hem per terminalvenster te zetten.
 *
 * Importeer dit bestand als ALLEREERSTE in een script, vóór `@prisma/client`.
 * De waarde wordt nooit getoond of gelogd.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(__dirname, '..', '..', '..', '.env');

if (!process.env.DATABASE_URL && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*DATABASE_URL\s*=\s*(.*)\s*$/.exec(line);
    if (match) {
      process.env.DATABASE_URL = match[1]!.trim().replace(/^["']|["']$/g, '');
      break;
    }
  }
}
