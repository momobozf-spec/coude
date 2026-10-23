import type { DonationType, PaymentMethod } from '@/generated/prisma/client'

import type { ZakatPaymentStatus } from '@/server/modules/donations/payment-service'

/** Presentation labels. No business meaning lives here. */

export const DONATION_TYPE_LABELS: Record<DonationType, string> = {
  ZAKAT: 'Zakat',
  SADAQAH: 'Sadaqah',
  SADAQAH_JARIYAH: 'Sadaqah Jariyah',
  FIDYA: 'Fidya',
  KAFFARAH: 'Kaffarah',
  WAQF: 'Waqf',
  OTHER: 'Overig',
}

export const DONATION_TYPE_HINTS: Record<DonationType, string> = {
  ZAKAT: 'Verplichte jaarlijkse bijdrage over je vermogen',
  SADAQAH: 'Vrijwillige gift',
  SADAQAH_JARIYAH: 'Doorlopende liefdadigheid, zoals een waterput of een school',
  FIDYA: 'Compensatie voor gemiste vastendagen',
  KAFFARAH: 'Boetedoening',
  WAQF: 'Schenking aan een blijvend fonds',
  OTHER: 'Iets dat niet in de lijst past',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Overschrijving',
  CARD: 'Kaart',
  CASH: 'Contant',
  DIRECT_DEBIT: 'Domiciliëring',
  IN_KIND: 'In natura',
  OTHER: 'Anders',
}

export const PAYMENT_STATUS_LABELS: Record<ZakatPaymentStatus, string> = {
  UNPAID: 'Nog niet betaald',
  PARTIALLY_PAID: 'Gedeeltelijk betaald',
  FULLY_PAID: 'Volledig geregistreerd',
  OVERPAID: 'Meer geregistreerd dan verschuldigd',
}

export const PAYMENT_STATUS_TONES: Record<
  ZakatPaymentStatus,
  'neutral' | 'warning' | 'success' | 'info'
> = {
  UNPAID: 'neutral',
  PARTIALLY_PAID: 'warning',
  FULLY_PAID: 'success',
  OVERPAID: 'info',
}

export const MONTH_NAMES = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
] as const

export const SADAQAH_PERIOD_LABELS: Record<string, string> = {
  DAILY: 'per dag',
  WEEKLY: 'per week',
  MONTHLY: 'per maand',
  YEARLY: 'per jaar',
}
