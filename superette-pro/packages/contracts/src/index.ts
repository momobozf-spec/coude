/**
 * Gedeelde contracten tussen de API (NestJS) en de klant-app (Next.js PWA).
 *
 * Eén bron van waarheid: de API valideert inkomende requests met deze schema's,
 * de PWA leidt haar types eruit af. Wijkt de PWA af, dan faalt de typecheck —
 * niet pas de runtime bij een klant die voor een dichte deur staat.
 */
export * from './access';
export * from './auth';
export * from './basket';
export * from './consent';
export * from './gate';
export * from './receipt';
export * from './compare';
