/**
 * Gedeeld door PoliteBrowser (Playwright) en PoliteScrapling (Scrapling):
 * dezelfde identificatie, dezelfde blokkeerherkenning, dezelfde fout.
 */
export const BOT_TOKEN = 'SuperetteBot';
export const BOT_VERSION = '0.1';

export class BlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedError';
  }
}

export const BLOCK_TITLE = /access denied|attention required|just a moment|captcha|are you a robot|pardon our interruption|request blocked/i;
