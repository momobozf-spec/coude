import 'server-only';

import { createAnthropicAnalyzer } from '@/lib/vision/anthropic';
import type { VisionAnalyzer } from '@/lib/vision/types';

/**
 * Levert de geconfigureerde vision-analyzer, of null.
 *
 * Null is een geldige toestand, geen fout: zonder provider werkt de
 * uitcheckwizard gewoon door en classificeert de gebruiker zelf. De UI toont
 * dat expliciet in plaats van een knop aan te bieden die niets doet.
 */
export function getVisionAnalyzer(): VisionAnalyzer | null {
  return createAnthropicAnalyzer();
}

export * from '@/lib/vision/types';
