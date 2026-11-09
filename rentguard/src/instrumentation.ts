/**
 * Draait één keer bij het starten van de server (niet tijdens `next build`).
 * Weigert te starten in productie met een ontwikkelconfiguratie: het proces
 * stopt met exitcode 1, zodat de deploy/health-check zichtbaar faalt.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { productionConfigProblems } = await import('@/lib/production-guard');
  const problems = productionConfigProblems(process.env);
  if (problems.length === 0) return;

  console.error(
    `RentGuard start niet in productie:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
  );
  process.exit(1);
}
