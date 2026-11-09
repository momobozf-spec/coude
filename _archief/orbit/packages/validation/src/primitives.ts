import { z } from 'zod';

/**
 * De bouwstenen waar alle andere schemas op rusten. Eén plek voor de grenzen
 * die zowel de client als de server moeten kennen.
 */

export const LIMITS = {
  titleMax: 500,
  descriptionMax: 20_000,
  plainTextMax: 500_000,
  tagNameMax: 50,
  projectNameMax: 120,
  folderNameMax: 120,
  checklistTextMax: 500,
  urlMax: 2048,
  emailMax: 254,
  passwordMin: 10,
  passwordMax: 128,
  nameMax: 120,
  blocksMax: 5000,
  checklistMax: 500,
  tagsPerItemMax: 50,
  attachmentBytesMax: 25 * 1024 * 1024,
  syncBatchMax: 500,
} as const;

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const ulidSchema = z.string().regex(ULID_PATTERN, 'Geen geldige ULID');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Verwacht formaat: JJJJ-MM-DD')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    if (month < 1 || month > 12) return false;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day >= 1 && day <= lastDay;
  }, 'Bestaat niet als kalenderdatum');

export const isoTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Verwacht formaat: UU:MM');

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: false, message: 'Verwacht een ISO-8601 timestamp in UTC' });

/** De logische klok reist als string omdat JSON geen bigint kent. */
export const serverSeqSchema = z.string().regex(/^\d{1,20}$/, 'Geen geldige serverSeq');

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Verwacht een hexkleur zoals #4F46E5');

export const timeZoneSchema = z.string().min(1).max(64).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Onbekende tijdzone');

export const localeSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Onbekende locale');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Geen geldig e-mailadres')
  .max(LIMITS.emailMax);

/**
 * Wachtwoordregels: lengte boven complexiteit. Een lange passphrase is sterker
 * dan `Wachtw00rd!` en een stuk minder irritant.
 */
export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Minimaal ${LIMITS.passwordMin} tekens`)
  .max(LIMITS.passwordMax)
  .refine((value) => value.trim().length === value.length || value.trim().length > 0, {
    message: 'Wachtwoord mag niet alleen uit spaties bestaan',
  });

export const urlSchema = z.string().url('Geen geldige URL').max(LIMITS.urlMax);

export const titleSchema = z.string().trim().min(1, 'Titel mag niet leeg zijn').max(LIMITS.titleMax);

export const sortKeySchema = z.string().min(1).max(200).regex(/^[0-9A-Za-z]+$/);

export const paginationSchema = z.object({
  cursor: z.string().max(500).nullish(),
  limit: z.number().int().min(1).max(200).default(50),
});

/** Vrije-tekst zoekopdracht; lengte begrensd om dure queries tegen te gaan. */
export const searchQuerySchema = z.string().trim().min(1).max(200);
