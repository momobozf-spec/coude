/**
 * Weergaveformattering, gedeeld door alle schermen.
 *
 * Apart van `notifications/alertMessage.ts`: dat bericht gaat naar een klant en
 * mag nooit veranderen omdat een dashboardkolom smaller moest. Dezelfde functie
 * voor beide zou die twee aan elkaar knopen.
 */
import type { ListingType, SellerType, SourceHealth } from '@prisma/client'

export function formatMoney(price: number | null, currency = 'EUR'): string {
  if (price === null) return '—'
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatDateTime(value: Date | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

export function formatRelative(value: Date | null, now: Date = new Date()): string {
  if (!value) return '—'

  const minutes = Math.max(0, Math.round((now.getTime() - value.getTime()) / 60_000))
  if (minutes < 1) return 'zonet'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} u`

  return `${Math.round(hours / 24)} d`
}

export function sellerTypeLabel(value: SellerType): string {
  return { PRIVATE: 'Particulier', PROFESSIONAL: 'Makelaar', UNKNOWN: 'Onbekend' }[value]
}

export function sellerTypeTone(value: SellerType): 'private' | 'professional' | 'unknown' {
  return { PRIVATE: 'private', PROFESSIONAL: 'professional', UNKNOWN: 'unknown' }[value] as
    | 'private'
    | 'professional'
    | 'unknown'
}

export function listingTypeLabel(value: ListingType | null): string {
  if (value === 'SALE') return 'Te koop'
  if (value === 'RENT') return 'Te huur'
  return '—'
}

export function healthLabel(value: SourceHealth): string {
  return {
    UNKNOWN: 'Onbekend',
    HEALTHY: 'Gezond',
    DEGRADED: 'Hapert',
    FAILING: 'Faalt',
    BLOCKED: 'Geblokkeerd',
    DISABLED: 'Uit',
  }[value]
}

export function healthTone(value: SourceHealth): 'good' | 'warn' | 'bad' | 'neutral' {
  if (value === 'HEALTHY') return 'good'
  if (value === 'DEGRADED') return 'warn'
  if (value === 'FAILING' || value === 'BLOCKED') return 'bad'
  return 'neutral'
}

/** Seconden als "2 min", "15 min", "1 u" — intervallen leesbaar maken. */
export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`
  return `${Math.round(seconds / 360) / 10} u`
}
