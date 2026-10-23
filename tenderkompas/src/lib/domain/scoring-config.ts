import { z } from "zod";

export const scoringConfigSchema = z.object({
  weights: z.object({
    services: z.number().min(0),
    technology: z.number().min(0),
    language: z.number().min(0),
    region: z.number().min(0),
    contractSize: z.number().min(0),
    capacity: z.number().min(0),
  }),
  thresholds: z.object({
    /** Minimum relevantiescore (0-100) voor advies "verder onderzoeken". */
    investigateMinScore: z.number().min(0).max(100),
    /** Minder dagen dan dit tot de eerste deadline = harde blokkade. */
    minPrepDaysHard: z.number().int().min(0),
    /** Minder dagen dan dit = krappe planning (aandachtspunt, geen blokkade). */
    minPrepDaysComfortable: z.number().int().min(0),
  }),
  /** Uitgesloten werkzaamheden van het profiel die in de opdracht voorkomen → harde blokkade. */
  exclusionIsHardBlocker: z.boolean(),
});

export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: { services: 30, technology: 25, language: 15, region: 10, contractSize: 10, capacity: 10 },
  thresholds: { investigateMinScore: 45, minPrepDaysHard: 7, minPrepDaysComfortable: 20 },
  exclusionIsHardBlocker: true,
};
