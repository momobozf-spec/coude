/**
 * De factory voor documentuitleg.
 *
 * ─── WAT DE AI-PROVIDER TE ZIEN KRIJGT ───────────────────────────────────────
 *
 * Belangrijk om expliciet vast te leggen, want documenten bevatten
 * rijksregisternummers, inkomens en adressen. Naar een extern model gaat:
 *
 *   - de categorie (enum, bijv. PURCHASE_AGREEMENT);
 *   - de weergavenaam die de gebruiker koos;
 *   - het mimetype;
 *   - de geëxtraheerde tekst, ALS die er is.
 *
 * Er gaat NIET heen: het bestand zelf, de storage key, de checksum, het
 * gebruikers-id, of enig ander veld uit de database.
 *
 * Zolang er geen tekstextractie is, ontvangt een model dus alleen metadata en
 * geen persoonsgegevens uit het document. Zodra extractie erbij komt, verandert
 * dat — en dan is dit de plek waar de routing naar een private endpoint hoort,
 * niet ergens in een route handler.
 *
 * ─── DE STANDAARD IS DE FIXTURE ──────────────────────────────────────────────
 *
 * `AI_ENABLED=false` (de standaard) levert redactionele uitleg. Dat is geen
 * degradatie: die tekst is door een mens nagelezen.
 */
import 'server-only'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import type {
  DocumentExplanation,
  DocumentExplanationProvider,
  ExplanationInput,
} from '@/types/documentExplanation'
import { AiExplanationProvider } from './aiProvider'
import { FixtureExplanationProvider } from './fixtureProvider'

let cached: DocumentExplanationProvider | undefined

export function getExplanationProvider(): DocumentExplanationProvider {
  cached ??= env.AI_ENABLED ? new AiExplanationProvider() : new FixtureExplanationProvider()
  return cached
}

/** Alleen voor tests. */
export function setExplanationProvider(provider: DocumentExplanationProvider | undefined): void {
  cached = provider
}

/**
 * Genereert uitleg, met de fixture als vangnet.
 *
 * Faalt het model, geeft het onbruikbare output, of overtreedt het de juridische
 * grenzen — dan komt er redactionele uitleg terug in plaats van een foutmelding.
 * Een gebruiker die op "leg uit" klikt bij zijn compromis, hoort niet met lege
 * handen te staan omdat een externe dienst hapert.
 */
export async function explainDocument(
  input: ExplanationInput,
): Promise<DocumentExplanation> {
  const provider = getExplanationProvider()

  if (provider.name === 'fixture') return provider.explain(input)

  try {
    return await provider.explain(input)
  } catch (error) {
    // De invoer gaat níet mee de log in: die kan documenttekst bevatten.
    logger.warn('AI-uitleg mislukt, redactionele uitleg gebruikt', {
      error: error instanceof Error ? error.message : 'onbekend',
    })
    return new FixtureExplanationProvider().explain(input)
  }
}

/**
 * Wat een externe provider zou ontvangen.
 *
 * Exported zodat de UI het kan tonen vóór de gebruiker op "leg uit" klikt, en
 * zodat een test kan vastleggen dat er niets bijkomt.
 */
export function describeDataSentToProvider(hasExtractedText: boolean): string[] {
  const lines = [
    'De categorie van het document (bijvoorbeeld “koopovereenkomst”).',
    'De naam die je het document gaf.',
    'Het bestandstype.',
  ]

  lines.push(
    hasExtractedText
      ? 'De tekst uit het document.'
      : 'Geen tekst uit het document — er is nog geen tekstextractie, dus het model ziet de inhoud niet.',
  )

  lines.push('Het bestand zelf, je naam en je gegevens gaan nooit mee.')
  return lines
}

export { FixtureExplanationProvider }
