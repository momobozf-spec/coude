/**
 * Het bronnenregister.
 *
 * Eén lijst, en de rest van het systeem kent geen enkele collector bij naam.
 * Een nieuwe bron toevoegen is daarmee: een bestand schrijven en hier één regel
 * bijzetten. Zie docs/ADDING-A-SOURCE.md.
 *
 * ─── DE DUBBELE SCHAKELAAR ───────────────────────────────────────────────────
 *
 * Een bron draait alleen als hij én in de database `enabled` is, én in
 * `COLLECTOR_ENABLED_SOURCES` staat. Twee schakelaars klinkt omslachtig maar
 * doet echt werk: de database is per omgeving anders en wordt via het dashboard
 * bediend, terwijl de env-variabele in de hand van degene ligt die de
 * omgeving deployt. Zo kan een bron nooit per ongeluk aangaan in productie
 * doordat iemand in een dashboard een vinkje zette, en nooit stilletjes
 * aanstaan doordat een seed hem aanzette.
 */
import { getEnv } from '@/lib/env'

import { demoMarketCollector } from './demo/demoMarketCollector'
import { fixtureCollector } from './fixture/fixtureCollector'
import { jsonLdFeedCollector } from './reference/jsonLdFeedCollector'
import type { CollectorDefinition } from './types'

const COLLECTORS: readonly CollectorDefinition[] = [
  fixtureCollector,
  demoMarketCollector,
  jsonLdFeedCollector,
]

const BY_KEY = new Map(COLLECTORS.map((collector) => [collector.key, collector]))

/** Alle geregistreerde collectors, ongeacht of ze aanstaan. */
export function allCollectors(): readonly CollectorDefinition[] {
  return COLLECTORS
}

export function getCollector(key: string): CollectorDefinition | null {
  return BY_KEY.get(key) ?? null
}

/** Staat deze bron in de env-allowlist? */
export function isSourceAllowedByEnv(key: string): boolean {
  return getEnv().COLLECTOR_ENABLED_SOURCES.includes(key)
}

/**
 * De collectors die daadwerkelijk mogen draaien: geregistreerd én toegestaan.
 * De `enabled`-vlag uit de database wordt door de scheduler gecontroleerd, die
 * de bronrijen toch al ophaalt.
 */
export function allowedCollectors(): CollectorDefinition[] {
  return COLLECTORS.filter((collector) => isSourceAllowedByEnv(collector.key))
}
