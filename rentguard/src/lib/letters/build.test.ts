import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildLetter } from '@/lib/letters/build';
import { resetEnvCache } from '@/lib/env';

const BASE_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
};

/** Supabase-dubbel dat faalt zodra er iets gelezen wordt. */
const untouchable = {
  from: () => {
    throw new Error('mag niet aangesproken worden');
  },
} as never;

describe('brieven achter feature-flag', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const [key, value] of Object.entries(BASE_ENV)) vi.stubEnv(key, value);
    resetEnvCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('bouwt geen ingebrekestelling zolang FEATURE_DEPOSIT_LETTERS uit staat', async () => {
    const result = await buildLetter({
      supabase: untouchable,
      type: 'DEPOSIT_CLAIM',
      locale: 'nl',
      fields: {},
    });
    expect(result.blockers).toEqual([{ kind: 'FEATURE_DISABLED' }]);
  });

  it('gaat voorbij de flag wanneer die expliciet aan staat', async () => {
    vi.stubEnv('FEATURE_DEPOSIT_LETTERS', 'true');
    resetEnvCache();
    await expect(
      buildLetter({ supabase: untouchable, type: 'DEPOSIT_CLAIM', locale: 'nl', fields: {} }),
    ).rejects.toThrow('mag niet aangesproken worden');
  });
});
