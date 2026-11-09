/**
 * Kleine helpers die overal gebruikt worden. Alles hier is puur en zonder
 * server-afhankelijkheden, zodat het ook in clientcomponenten mag.
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Bedragen in hele euro's. Geen centen: het hele datamodel rekent in hele
 * euro's voor prijzen (zie de kop van schema.prisma).
 */
export function formatEuro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Bedragen die in eurocent zijn opgeslagen (maandlasten, totalen). */
export function formatEuroCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    d,
  )
}

export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' }).format(d)
}

/** Afstand in meters, leesbaar. Onder 1 km in stappen van 10 m. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/**
 * Aantal hele dagen tussen nu en een datum. Negatief = in het verleden.
 * Rekent op kalenderdagen, niet op 24-uursblokken: "morgen om 9u" moet 1 zijn,
 * ook als het nu 23u is.
 */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`
}
