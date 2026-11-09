/**
 * Productie-guard: de server weigert te starten in productie met een
 * configuratie die alleen voor ontwikkeling bedoeld is.
 *
 * Wordt aangeroepen vanuit `src/instrumentation.ts` (bij serverstart, niet
 * tijdens `next build`).
 */
export function productionConfigProblems(
  env: Record<string, string | undefined>,
): string[] {
  if (env.NODE_ENV !== 'production') return [];

  const problems: string[] = [];
  const appUrl = env.APP_URL ?? '';

  if (!appUrl.startsWith('https://') || /localhost|127\.0\.0\.1/.test(appUrl)) {
    problems.push('APP_URL moet een publieke https-URL zijn.');
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!supabaseUrl || /placeholder|your-project|localhost/.test(supabaseUrl)) {
    problems.push('NEXT_PUBLIC_SUPABASE_URL is een placeholder of ontbreekt.');
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const value = env[key] ?? '';
    if (!value || /placeholder|^ci-/.test(value)) {
      problems.push(`${key} is een placeholder of ontbreekt.`);
    }
  }

  if (!env.LEGAL_ENTITY_ADDRESS?.trim()) {
    problems.push(
      'LEGAL_ENTITY_ADDRESS ontbreekt (straat + nr. van de maatschappelijke zetel; wettelijk verplicht op de site).',
    );
  }

  const stripeKey = env.STRIPE_SECRET_KEY ?? '';
  if (stripeKey) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      problems.push('STRIPE_WEBHOOK_SECRET ontbreekt terwijl STRIPE_SECRET_KEY gezet is.');
    }
    const allowTest =
      env.ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION === 'true' ||
      env.ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION === '1';
    if (/^(sk|rk)_test_/.test(stripeKey) && !allowTest) {
      problems.push(
        'STRIPE_SECRET_KEY is een testsleutel. Gebruik een live-sleutel of zet ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION=true (alleen staging).',
      );
    }
  }

  return problems;
}

export function assertProductionConfig(
  env: Record<string, string | undefined> = process.env,
): void {
  const problems = productionConfigProblems(env);
  if (problems.length > 0) {
    throw new Error(
      `RentGuard start niet in productie:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
}
