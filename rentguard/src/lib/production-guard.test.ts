import { describe, expect, it } from 'vitest';

import { assertProductionConfig, productionConfigProblems } from '@/lib/production-guard';

const GOOD = {
  NODE_ENV: 'production',
  APP_URL: 'https://rentguard.example.be',
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcd.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJ-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJ-service',
  LEGAL_ENTITY_ADDRESS: 'Straat 1, 1930 Zaventem',
  STRIPE_SECRET_KEY: 'sk_live_abc',
  STRIPE_WEBHOOK_SECRET: 'whsec_abc',
};

describe('productie-guard', () => {
  it('laat een volledige productieconfiguratie toe', () => {
    expect(productionConfigProblems(GOOD)).toEqual([]);
    expect(() => assertProductionConfig(GOOD)).not.toThrow();
  });

  it('doet niets buiten productie', () => {
    expect(productionConfigProblems({ NODE_ENV: 'development' })).toEqual([]);
  });

  it('weigert de CI-placeholders', () => {
    const problems = productionConfigProblems({
      ...GOOD,
      NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'ci-placeholder-service-role-key',
    });
    expect(problems).toHaveLength(2);
  });

  it('weigert localhost en http', () => {
    expect(productionConfigProblems({ ...GOOD, APP_URL: 'http://localhost:3000' })).toHaveLength(1);
  });

  it('eist het adres van de uitbater', () => {
    expect(productionConfigProblems({ ...GOOD, LEGAL_ENTITY_ADDRESS: '' })[0]).toMatch(
      /LEGAL_ENTITY_ADDRESS/,
    );
  });

  it('weigert Stripe-testsleutels, tenzij expliciet voor staging', () => {
    const test = { ...GOOD, STRIPE_SECRET_KEY: 'sk_test_abc' };
    expect(productionConfigProblems(test)).toHaveLength(1);
    expect(
      productionConfigProblems({ ...test, ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION: 'true' }),
    ).toEqual([]);
  });

  it('eist een webhookgeheim bij een Stripe-sleutel', () => {
    expect(productionConfigProblems({ ...GOOD, STRIPE_WEBHOOK_SECRET: undefined })).toHaveLength(1);
  });
});
