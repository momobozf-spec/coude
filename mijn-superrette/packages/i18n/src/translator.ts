import type { Locale } from '@superrette/domain';
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';
import { nl } from './locales/nl.js';
import type { MessageKey, Messages, PluralMessage } from './types.js';

export const catalogs: Record<Locale, Messages> = { nl, fr, en };
export const SUPPORTED_LOCALES: readonly Locale[] = ['nl', 'fr', 'en'];

export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

function lookup(messages: Messages, key: string): string | PluralMessage | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === 'string') return node;
  if (node && typeof node === 'object' && 'other' in node) return node as PluralMessage;
  return undefined;
}

export function interpolate(template: string, params: TranslateParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

export function resolveLocale(input: string | null | undefined): Locale {
  const base = (input ?? '').toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base ?? '') ? (base as Locale) : 'nl';
}

/**
 * Create a translator. Missing keys fall back to Dutch, then to the key
 * itself, so a missing translation never crashes the UI.
 */
export function createTranslator(locale: Locale): Translate {
  const messages = catalogs[locale];
  const plural = new Intl.PluralRules(locale);
  return (key, params) => {
    const message = lookup(messages, key) ?? lookup(nl, key);
    if (message === undefined) return key;
    if (typeof message === 'string') return interpolate(message, params);
    const count = Number(params?.count ?? 0);
    const form = plural.select(count) === 'one' ? message.one : message.other;
    return interpolate(form, params);
  };
}
