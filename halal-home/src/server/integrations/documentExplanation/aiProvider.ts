/**
 * Documentuitleg via een taalmodel.
 *
 * Gebruikt de bestaande `AiProvider`-abstractie, dus de keuze tussen Anthropic
 * en OpenAI staat hier niet — die staat in `AI_PROVIDER`. De modelnaam komt uit
 * `AI_MODEL` en staat nergens in deze code.
 *
 * ─── DE GRENZEN WORDEN NA AFLOOP GECONTROLEERD ───────────────────────────────
 *
 * De systeemprompt vraagt om geen juridisch advies. `assertNoLegalAdvice()`
 * controleert of dat ook gebeurd is. Een prompt is een verzoek; deze controle
 * is de beslissing. Overtreedt de output de grenzen, dan gooien we — en de
 * factory valt terug op redactionele uitleg.
 */
import 'server-only'
import { z } from 'zod'

import { env } from '@/config/env'
import { getAiProvider } from '@/server/integrations/ai'
import {
  assertNoLegalAdvice,
  EXPLANATION_DISCLAIMER,
  EXPLANATION_SYSTEM_PROMPT,
  EXPLANATION_VERSION,
} from '@/modules/documents/domain/legalGuardrails'
import type {
  DocumentExplanation,
  DocumentExplanationProvider,
  ExplanationInput,
} from '@/types/documentExplanation'

/**
 * Het contract voor de modeloutput.
 *
 * Let op wat er níet in staat: geen `conclusion`, geen `advice`, geen
 * `isValid`. Met `.strict()` kan het model die velden ook niet toevoegen — de
 * vorm sluit een heel soort antwoord uit.
 */
const responseSchema = z
  .object({
    summary: z.string().min(1).max(2000),
    keyPoints: z.array(z.string().min(1).max(500)).max(8).default([]),
    attentionPoints: z.array(z.string().min(1).max(500)).max(8).default([]),
    questionsForProfessional: z.array(z.string().min(1).max(500)).max(8).default([]),
  })
  .strict()

const JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'keyPoints', 'attentionPoints', 'questionsForProfessional'],
  properties: {
    summary: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    attentionPoints: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    questionsForProfessional: { type: 'array', items: { type: 'string' }, maxItems: 8 },
  },
}

export class AiExplanationProvider implements DocumentExplanationProvider {
  readonly name = 'ai'

  supports(): boolean {
    return env.AI_ENABLED
  }

  async explain(input: ExplanationInput): Promise<DocumentExplanation> {
    const ai = getAiProvider()

    const { value, model } = await ai.completeJson({
      system: EXPLANATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(input) }],
      schemaName: 'DocumentExplanation',
      jsonSchema: JSON_SCHEMA,
      validate: (raw) => responseSchema.parse(raw),
      maxTokens: 2048,
      temperature: 0,
    })

    // Gooit wanneer het model toch een oordeel velde. De factory vangt dat op
    // en valt terug op redactionele uitleg.
    assertNoLegalAdvice(value)

    return {
      ...value,
      // De disclaimer komt uit de domeinlaag, niet uit het model: hij mag niet
      // afhangen van wat een model die keer besluit te schrijven.
      disclaimer: EXPLANATION_DISCLAIMER,
      source: 'AI',
      provider: ai.name,
      model,
      version: EXPLANATION_VERSION,
      sourceChecksum: input.sourceChecksum ?? null,
    }
  }
}

/**
 * Het bericht aan het model.
 *
 * Bevat uitsluitend wat in `describeDataSentToProvider()` staat. Wie hier een
 * veld toevoegt, moet die functie meewijzigen — anders klopt wat we de
 * gebruiker vertellen niet meer.
 */
function buildUserMessage(input: ExplanationInput): string {
  const parts = [
    `Documentsoort: ${input.category}`,
    `Naam die de gebruiker gaf: ${input.displayName}`,
    `Bestandstype: ${input.mimeType}`,
  ]

  if (input.extractedText) {
    parts.push('', 'Tekst uit het document:', input.extractedText.slice(0, 20_000))
  } else {
    parts.push(
      '',
      'De tekst van dit document is niet beschikbaar. Leg uit waarvoor dit soort document ' +
        'dient in een Belgisch aankoopdossier, waar men doorgaans op let, en welke vragen ' +
        'zinnig zijn voor de notaris. Doe geen uitspraken over de inhoud van dít bestand.',
    )
  }

  return parts.join('\n')
}
