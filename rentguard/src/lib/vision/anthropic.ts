import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { getEnv } from '@/lib/env';
import type { Locale } from '@/i18n/config';
import {
  applyConfidenceThreshold,
  type VisionAnalyzer,
  type VisionCompareInput,
  type VisionComparisonResult,
  type VisionPhotoInput,
} from '@/lib/vision/types';

/**
 * Adapter voor Claude vision.
 *
 * Keuzes die hier bewust zijn gemaakt:
 *
 *  - **Gestructureerde uitvoer via `messages.parse()` met een Zod-schema.**
 *    Zo hoeft er geen vrije tekst geparseerd te worden en kan het model geen
 *    veld verzinnen dat wij niet verwachten.
 *  - **Geen kostenschatting.** Het model mag alleen posten aanduiden uit de
 *    lijst die wij meegeven; bedragen komen uit `repair_cost_reference`.
 *  - **Geen juridische taal.** Het model classificeert een waarneming; het
 *    spreekt zich niet uit over aansprakelijkheid.
 *  - **Een weigering is geen fout.** Weigert het model, dan wordt dat
 *    `UNCLEAR` met een duidelijke reden, en beoordeelt de gebruiker zelf.
 *    Daarom is de serverside `fallbacks`-parameter hier niet nodig: er is een
 *    zinvolle, veilige uitweg die de gebruiker niets kost.
 */

const comparisonSchema = z.object({
  classification: z
    .enum(['WEAR_AND_TEAR', 'DAMAGE', 'UNCLEAR'])
    .describe(
      'WEAR_AND_TEAR for deterioration expected from normal living over the ' +
        'occupancy period. DAMAGE for deterioration beyond normal use. ' +
        'UNCLEAR when the photos do not allow a confident judgement.',
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('How certain you are, from 0 to 1. Be conservative.'),
  observed_differences: z
    .array(z.string())
    .describe(
      'Factual, visually verifiable differences between the two photos. ' +
        'Describe only what is visible. Empty array if there is no difference.',
    ),
  reasoning: z
    .string()
    .describe(
      'Two or three sentences explaining the classification, referring to the ' +
        'observed differences and the occupancy period.',
    ),
  suggested_repair_item_keys: z
    .array(z.string())
    .describe(
      'Zero or more keys chosen ONLY from the allowed list provided in the ' +
        'prompt. Do not invent keys. Empty array if none apply.',
    ),
  photos_comparable: z
    .boolean()
    .describe(
      'False when the two photos show clearly different places or angles that ' +
        'make comparison unreliable.',
    ),
});

const SYSTEM_PROMPT = `You compare two photographs of the same spot in a rented home: one taken when the tenant moved in, one when they moved out. You classify the difference between them.

You are looking at evidence in a dispute about a rental deposit. A wrong "damage" call costs a real person money they should keep. A wrong "wear and tear" call costs their landlord money. Be careful and be conservative: when the photos do not let you judge confidently, say UNCLEAR.

How to distinguish wear and tear from damage:

- WEAR_AND_TEAR is deterioration you would expect from ordinary living over the occupancy period, without misuse or neglect. Examples: paint dulling or slight discolouration, small scuffs on walls at furniture height, carpet flattened along walking routes, minor wear on door handles, limescale that cleans off, hairline settling cracks.
- DAMAGE is deterioration beyond ordinary use, or caused by an incident or neglect. Examples: burn marks, tears or cuts in flooring, holes larger than a picture hook, torn or drawn-on wallpaper, broken fittings, mould from unventilated rooms, stains that have soaked in.
- Weigh the occupancy period. Worn paint after eight years is expected; the same wear after eight months is not.
- Judge only the spot the two photos have in common. Different furniture, lighting or time of day are not differences in condition.

Hard limits on what you may say:

- Do NOT estimate any cost, price or amount. Not in euros, not as a range, not as a description like "expensive". Costs come from a separate reference table.
- Do NOT state or imply who is liable, what the law says, or what a judge would decide.
- Do NOT reference legal articles, statutes or case law.
- Only choose repair item keys from the allowed list given in the prompt. Never invent a key.
- Describe what you can see. Do not speculate about what caused something unless the photo shows it.

Your output is reviewed and confirmed or corrected by the tenant before it is used anywhere. Say plainly when you are unsure.`;

function mediaTypeFor(contentType: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const normalised = contentType.toLowerCase();
  if (normalised === 'image/png') return 'image/png';
  if (normalised === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function imageBlock(photo: VisionPhotoInput) {
  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: mediaTypeFor(photo.contentType),
      data: Buffer.from(photo.bytes).toString('base64'),
    },
  };
}

function userPrompt(input: VisionCompareInput, locale: Locale): string {
  const occupancy =
    input.monthsOccupied === null
      ? 'The occupancy period is unknown. Take that uncertainty into account.'
      : `The tenant lived there for approximately ${input.monthsOccupied} months.`;

  const allowed =
    input.allowedRepairItemKeys.length > 0
      ? input.allowedRepairItemKeys.join(', ')
      : '(none available - return an empty array)';

  return [
    `Location: ${input.checkIn.roomLabel} - ${input.checkIn.slotLabel}.`,
    occupancy,
    '',
    'The first image is the move-in photo. The second image is the move-out photo.',
    '',
    `Allowed repair item keys: ${allowed}`,
    '',
    `Write reasoning and observed differences in ${
      locale === 'nl' ? 'Dutch' : 'French'
    }, in plain language the tenant can read.`,
  ].join('\n');
}

export class AnthropicVisionAnalyzer implements VisionAnalyzer {
  readonly id = 'anthropic';
  readonly model: string;

  private readonly client: Anthropic;
  private readonly threshold: number;

  constructor(apiKey: string, model: string, threshold: number) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.threshold = threshold;
  }

  async comparePhotos(
    input: VisionCompareInput,
  ): Promise<VisionComparisonResult> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      thinking: { type: 'adaptive' },
      output_config: { format: zodOutputFormat(comparisonSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Move-in photo:' },
            imageBlock(input.checkIn),
            { type: 'text', text: 'Move-out photo:' },
            imageBlock(input.checkOut),
            { type: 'text', text: userPrompt(input, input.locale) },
          ],
        },
      ],
    });

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    // Een weigering is geen storing: het dossier valt terug op menselijke
    // beoordeling, wat toch al de bedoeling was.
    if (response.stop_reason === 'refusal') {
      return {
        classification: 'UNCLEAR',
        rawClassification: 'UNCLEAR',
        confidence: 0,
        observedDifferences: [],
        reasoning:
          input.locale === 'nl'
            ? 'De geautomatiseerde analyse kon dit fotopaar niet beoordelen. ' +
              'Beoordeel het zelf.'
            : "L'analyse automatisée n'a pas pu évaluer cette paire de photos. " +
              'Évaluez-la vous-même.',
        suggestedRepairItemKeys: [],
        forcedUnclear: false,
        refused: true,
        provider: this.id,
        model: this.model,
        usage,
      };
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      return {
        classification: 'UNCLEAR',
        rawClassification: 'UNCLEAR',
        confidence: 0,
        observedDifferences: [],
        reasoning:
          input.locale === 'nl'
            ? 'De analyse leverde geen bruikbaar resultaat op. Beoordeel dit ' +
              'fotopaar zelf.'
            : "L'analyse n'a pas produit de résultat exploitable. Évaluez cette " +
              'paire de photos vous-même.',
        suggestedRepairItemKeys: [],
        forcedUnclear: false,
        refused: false,
        provider: this.id,
        model: this.model,
        usage,
      };
    }

    // Onvergelijkbare foto's zijn per definitie onduidelijk.
    const rawClassification = parsed.photos_comparable
      ? parsed.classification
      : 'UNCLEAR';

    const { classification, forcedUnclear } = applyConfidenceThreshold(
      rawClassification,
      parsed.confidence,
      this.threshold,
    );

    // Het model mag geen posten verzinnen: alles buiten de toegestane lijst
    // valt weg.
    const allowed = new Set(input.allowedRepairItemKeys);
    const suggestedRepairItemKeys = parsed.suggested_repair_item_keys.filter(
      (key) => allowed.has(key),
    );

    return {
      classification,
      rawClassification,
      confidence: parsed.confidence,
      observedDifferences: parsed.observed_differences,
      reasoning: parsed.reasoning,
      suggestedRepairItemKeys,
      forcedUnclear,
      refused: false,
      provider: this.id,
      model: this.model,
      usage,
    };
  }
}

export function createAnthropicAnalyzer(): AnthropicVisionAnalyzer | null {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) return null;

  return new AnthropicVisionAnalyzer(
    env.ANTHROPIC_API_KEY,
    env.VISION_MODEL,
    env.VISION_CONFIDENCE_THRESHOLD,
  );
}
