import { describe, expect, it } from 'vitest';

import { isFeatureEnabled } from '@/lib/features';

const OFF = {
  FEATURE_DEPOSIT_LETTERS: false,
  FEATURE_TENANT_PROTECT_SUBSCRIPTION: false,
};

describe('feature-flags', () => {
  it('staan standaard uit', () => {
    expect(isFeatureEnabled('depositLetters', OFF)).toBe(false);
    expect(isFeatureEnabled('tenantProtectSubscription', OFF)).toBe(false);
  });

  it('gaan alleen aan met een expliciete waarde', () => {
    expect(
      isFeatureEnabled('depositLetters', { ...OFF, FEATURE_DEPOSIT_LETTERS: true }),
    ).toBe(true);
  });
});
