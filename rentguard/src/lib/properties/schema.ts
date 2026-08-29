import { z } from 'zod';

import { isBrusselsPostalCode } from '@/lib/properties/brussels';

/**
 * Validatie van woninggegevens.
 *
 * Bewust ruim: bijna alles is optioneel. Een huurder die net verhuisd is, heeft
 * zijn EPB-label of de exacte oppervlakte niet paraat, en wij willen dat hij
 * meteen kan beginnen fotograferen. Wat ontbreekt, vragen wij later opnieuw op
 * het moment dat het nodig is voor een berekening.
 */

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

const optionalAmount = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'number') return value;
    const cleaned = value.trim().replace(/\s/g, '').replace(',', '.');
    if (cleaned === '') return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine((value) => value === null || (!Number.isNaN(value) && value >= 0), {
    message: 'INVALID_AMOUNT',
  })
  .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine(
    (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    { message: 'INVALID_DATE' },
  );

const optionalBoolean = z
  .union([z.literal('yes'), z.literal('no'), z.literal('unknown'), z.literal('')])
  .transform((value) =>
    value === 'yes' ? true : value === 'no' ? false : null,
  );

export const propertySchema = z
  .object({
    address: z.string().trim().min(5).max(300),
    postalCode: z
      .string()
      .trim()
      .refine(isBrusselsPostalCode, { message: 'NOT_BRUSSELS' }),
    municipality: z.string().trim().min(2).max(120),

    monthlyRent: optionalAmount,
    monthlyCharges: optionalAmount,
    depositAmount: optionalAmount,
    depositType: z.enum([
      'INDIVIDUAL_ACCOUNT',
      'BANK_GUARANTEE_CPAS',
      'PROGRESSIVE_BANK_GUARANTEE',
      'REAL_SECURITY',
      'PERSONAL_SURETY',
      'OTHER',
      'UNKNOWN',
    ]),

    leaseSignedOn: optionalDate,
    leaseStart: optionalDate,
    leaseEnd: optionalDate,
    leaseRegistered: optionalBoolean,
    pebCertificateProvided: optionalBoolean,
    pebRating: z
      .union([z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']), z.literal('')])
      .transform((value) => (value === '' ? null : value)),

    surfaceM2: optionalAmount,
    bedrooms: optionalAmount,

    landlordName: optionalString(200),
    landlordAddress: optionalString(300),
    landlordEmail: z
      .union([z.string().trim().email(), z.literal('')])
      .transform((value) => (value === '' ? null : value)),

    retentionYears: z.coerce.number().int().min(1).max(10),
  })
  .refine(
    (data) =>
      !data.leaseStart ||
      !data.leaseEnd ||
      new Date(data.leaseEnd) >= new Date(data.leaseStart),
    { message: 'END_BEFORE_START', path: ['leaseEnd'] },
  )
  .refine(
    (data) =>
      !data.leaseSignedOn ||
      !data.leaseStart ||
      new Date(data.leaseSignedOn) <= new Date(data.leaseStart),
    { message: 'SIGNED_AFTER_START', path: ['leaseSignedOn'] },
  );

export type PropertyInput = z.infer<typeof propertySchema>;

/**
 * Waarschuwing wanneer de waarborg meer dan twee maanden huur lijkt te
 * bedragen. Dit is een **signalering**, geen oordeel: het wettelijke maximum
 * geldt pas voor contracten gesloten of hernieuwd vanaf 1 november 2024, en de
 * app kent de exacte contractgeschiedenis niet.
 */
export function depositExceedsTwoMonths(
  monthlyRent: number | null,
  depositAmount: number | null,
): boolean {
  if (!monthlyRent || !depositAmount || monthlyRent <= 0) return false;
  // Kleine marge: huurprijzen worden soms afgerond ingevoerd.
  return depositAmount > monthlyRent * 2 * 1.01;
}
