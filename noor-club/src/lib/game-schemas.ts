import { z } from "zod";

const i18nText = z.record(z.string(), z.string()); // { nl, en, fr, de }

export const matchSchema = z.object({
  pairs: z
    .array(
      z.object({
        id: z.string(),
        left: z.string(), // Arabisch teken of woord
        right: i18nText, // vertaling/klank
        audioUrl: z.string().optional(),
      }),
    )
    .min(3)
    .max(12),
});

export const sequenceSchema = z.object({
  prompt: i18nText,
  items: z
    .array(
      z.object({
        id: z.string(),
        label: i18nText,
        order: z.number().int(),
        iconUrl: z.string().optional(),
      }),
    )
    .min(3)
    .max(8),
});

export const quizSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: i18nText,
        options: z.array(i18nText).min(2).max(4),
        correctIndex: z.number().int().min(0),
        explanation: i18nText.optional(),
      }),
    )
    .min(3)
    .max(15),
});

export const listenSchema = z.object({
  rounds: z
    .array(
      z.object({
        id: z.string(),
        audioUrl: z.string(),
        options: z.array(z.string()).min(2).max(4), // Arabische glyphs
        correctIndex: z.number().int().min(0),
      }),
    )
    .min(3)
    .max(12),
});

export const wordBuildSchema = z.object({
  words: z
    .array(
      z.object({
        id: z.string(),
        word: z.string(), // "بيت"
        letters: z.array(z.string()), // ["ب","ي","ت"] plus afleiders
        meaning: i18nText,
        audioUrl: z.string().optional(),
      }),
    )
    .min(3)
    .max(10),
});

export const ENGINE_SCHEMAS = {
  MATCH: matchSchema,
  SEQUENCE: sequenceSchema,
  QUIZ: quizSchema,
  LISTEN: listenSchema,
  WORDBUILD: wordBuildSchema,
} as const;

export type MatchData = z.infer<typeof matchSchema>;
export type SequenceData = z.infer<typeof sequenceSchema>;
export type QuizData = z.infer<typeof quizSchema>;
export type ListenData = z.infer<typeof listenSchema>;
export type WordBuildData = z.infer<typeof wordBuildSchema>;

/** The five engine identifiers, mirroring the `GameEngine` enum in Prisma. */
export const ENGINE_NAMES = ["MATCH", "SEQUENCE", "QUIZ", "LISTEN", "WORDBUILD"] as const;
export type EngineName = (typeof ENGINE_NAMES)[number];

export type EngineDataMap = {
  MATCH: MatchData;
  SEQUENCE: SequenceData;
  QUIZ: QuizData;
  LISTEN: ListenData;
  WORDBUILD: WordBuildData;
};

export function isEngineName(value: string): value is EngineName {
  return (ENGINE_NAMES as readonly string[]).includes(value);
}

/**
 * A discriminated union, deliberately written out per engine rather than
 * indexed off `EngineDataMap`. That correlation is what lets `GameHost` do
 * `switch (parsed.engine)` and get `parsed.data` narrowed to the right payload
 * type — with an indexed type TypeScript keeps the union and the registry can
 * only be typed with a cast.
 */
export type ParsedGameData =
  | { ok: true; engine: "MATCH"; data: MatchData }
  | { ok: true; engine: "SEQUENCE"; data: SequenceData }
  | { ok: true; engine: "QUIZ"; data: QuizData }
  | { ok: true; engine: "LISTEN"; data: ListenData }
  | { ok: true; engine: "WORDBUILD"; data: WordBuildData }
  | { ok: false; issue: string };

function describe(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "ongeldige payload";
  const path = first.path.length > 0 ? first.path.join(".") : "data";
  return `${path}: ${first.message}`;
}

/**
 * Validates a raw payload against the schema belonging to `engine`.
 *
 * Used in two places: the seed script (fail loudly, before anything reaches the
 * database) and `GameHost` (fail softly, rendering an error card). Both call
 * sites need the reason, so failures are returned rather than thrown.
 */
export function parseGameData(engine: string, raw: unknown): ParsedGameData {
  switch (engine) {
    case "MATCH": {
      const result = matchSchema.safeParse(raw);
      return result.success
        ? { ok: true, engine: "MATCH", data: result.data }
        : { ok: false, issue: describe(result.error) };
    }
    case "SEQUENCE": {
      const result = sequenceSchema.safeParse(raw);
      return result.success
        ? { ok: true, engine: "SEQUENCE", data: result.data }
        : { ok: false, issue: describe(result.error) };
    }
    case "QUIZ": {
      const result = quizSchema.safeParse(raw);
      return result.success
        ? { ok: true, engine: "QUIZ", data: result.data }
        : { ok: false, issue: describe(result.error) };
    }
    case "LISTEN": {
      const result = listenSchema.safeParse(raw);
      return result.success
        ? { ok: true, engine: "LISTEN", data: result.data }
        : { ok: false, issue: describe(result.error) };
    }
    case "WORDBUILD": {
      const result = wordBuildSchema.safeParse(raw);
      return result.success
        ? { ok: true, engine: "WORDBUILD", data: result.data }
        : { ok: false, issue: describe(result.error) };
    }
    default:
      return { ok: false, issue: `Onbekende engine: ${engine}` };
  }
}

/**
 * Extra invariants zod's shape checks cannot express: every `correctIndex` must
 * actually point at an existing option, and word puzzles must be solvable from
 * the letters that are offered.
 */
export function checkGameInvariants(parsed: ParsedGameData): string | null {
  if (!parsed.ok) return parsed.issue;

  switch (parsed.engine) {
    case "QUIZ": {
      for (const question of parsed.data.questions) {
        if (question.correctIndex >= question.options.length) {
          return `Vraag ${question.id}: correctIndex ${question.correctIndex} valt buiten ${question.options.length} opties.`;
        }
      }
      return null;
    }
    case "LISTEN": {
      for (const round of parsed.data.rounds) {
        if (round.correctIndex >= round.options.length) {
          return `Ronde ${round.id}: correctIndex ${round.correctIndex} valt buiten ${round.options.length} opties.`;
        }
      }
      return null;
    }
    case "WORDBUILD": {
      for (const word of parsed.data.words) {
        const pool = [...word.letters];
        for (const glyph of Array.from(word.word)) {
          const index = pool.indexOf(glyph);
          if (index === -1) {
            return `Woord ${word.id}: letter "${glyph}" ontbreekt in de aangeboden letters.`;
          }
          pool.splice(index, 1);
        }
      }
      return null;
    }
    case "SEQUENCE": {
      const orders = new Set(parsed.data.items.map((item) => item.order));
      if (orders.size !== parsed.data.items.length) {
        return "Sequence: elk item heeft een uniek `order` nodig.";
      }
      return null;
    }
    case "MATCH": {
      const ids = new Set(parsed.data.pairs.map((pair) => pair.id));
      if (ids.size !== parsed.data.pairs.length) {
        return "Match: elk paar heeft een uniek `id` nodig.";
      }
      return null;
    }
  }
}
