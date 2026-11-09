/**
 * JSON-LD uit HTML halen.
 *
 * Waarom dit een eigen module is: JSON-LD (`schema.org`) is de derde stap in de
 * voorkeursvolgorde — na een officiële API en een publieke feed, maar vóór het
 * uit elkaar trekken van HTML. Veel vastgoedsites zetten er hun advertentie
 * gestructureerd in omdat Google erom vraagt. Dat is publiek bedoelde,
 * machineleesbare data: precies wat je wil lezen, en het breekt niet zodra
 * iemand de opmaak aanpast.
 */
import * as cheerio from 'cheerio'

import { parseEuropeanNumber } from '@/lib/number'

/** Alle JSON-LD-blokken uit een HTML-document, in documentvolgorde. */
export function extractJsonLdBlocks(html: string): unknown[] {
  const $ = cheerio.load(html)
  const blocks: unknown[] = []

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text().trim()
    if (raw.length === 0) return

    try {
      blocks.push(JSON.parse(raw))
    } catch {
      // Eén stuk kapotte JSON-LD mag de rest van de pagina niet meenemen.
      // Sites zetten er soms ongeëscapete aanhalingstekens in.
    }
  })

  return blocks
}

/**
 * Vlakt JSON-LD uit tot losse entiteiten.
 *
 * Nodig omdat een blok drie vormen kan hebben: één object, een array van
 * objecten, of een `@graph` met de objecten erin. Alledrie komen in het wild
 * voor, en een collector wil ze niet alledrie zelf hoeven herkennen.
 */
export function flattenJsonLd(blocks: readonly unknown[]): Record<string, unknown>[] {
  const entities: Record<string, unknown>[] = []

  const visit = (node: unknown, depth: number): void => {
    if (depth > 6 || node === null || typeof node !== 'object') return

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }

    const record = node as Record<string, unknown>
    if ('@graph' in record) visit(record['@graph'], depth + 1)
    if ('itemListElement' in record) visit(record.itemListElement, depth + 1)
    if ('item' in record && typeof record.item === 'object') visit(record.item, depth + 1)

    if ('@type' in record) entities.push(record)
  }

  for (const block of blocks) visit(block, 0)
  return entities
}

/** Hoort dit `@type` bij het gevraagde type? `@type` mag ook een array zijn. */
export function hasType(entity: Record<string, unknown>, ...types: string[]): boolean {
  const value = entity['@type']
  const wanted = types.map((type) => type.toLowerCase())

  if (typeof value === 'string') return wanted.includes(value.toLowerCase())
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'string' && wanted.includes(item.toLowerCase()))
  }
  return false
}

/** Leest een veld dat een string, een getal of een genest object kan zijn. */
export function readString(entity: Record<string, unknown>, ...path: string[]): string | undefined {
  let current: unknown = entity

  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }

  if (typeof current === 'string') return current.trim() || undefined
  if (typeof current === 'number') return String(current)
  // schema.org staat `{"@value": "..."}` toe voor getypeerde literals.
  if (current !== null && typeof current === 'object' && '@value' in current) {
    const value = (current as Record<string, unknown>)['@value']
    if (typeof value === 'string' || typeof value === 'number') return String(value)
  }
  return undefined
}

export function readNumber(entity: Record<string, unknown>, ...path: string[]): number | undefined {
  const raw = readString(entity, ...path)
  if (raw === undefined) return undefined

  // schema.org schrijft prijzen als "329000", "329000.00" of, bij sites die het
  // veld met opmaak vullen, "€ 329.000". Die laatste vorm is de reden dat dit
  // via `parseEuropeanNumber` loopt en niet via `Number()`.
  return parseEuropeanNumber(raw) ?? undefined
}

export function readDate(entity: Record<string, unknown>, ...path: string[]): Date | undefined {
  const raw = readString(entity, ...path)
  if (raw === undefined) return undefined
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
