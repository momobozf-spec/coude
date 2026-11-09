import { getEnv, type ServerEnv } from '@/lib/env';

/**
 * Feature-flags.
 *
 * Alles staat standaard UIT. Een flag gaat pas aan met een expliciete
 * omgevingsvariabele (`true` of `1`), zodat een vergeten configuratie nooit
 * per ongeluk een onafgewerkte of juridisch niet-nagekeken functie live zet.
 */
export type FeatureFlag = 'depositLetters' | 'tenantProtectSubscription';

export function isFeatureEnabled(
  flag: FeatureFlag,
  env: Pick<
    ServerEnv,
    'FEATURE_DEPOSIT_LETTERS' | 'FEATURE_TENANT_PROTECT_SUBSCRIPTION'
  > = getEnv(),
): boolean {
  switch (flag) {
    case 'depositLetters':
      return env.FEATURE_DEPOSIT_LETTERS === true;
    case 'tenantProtectSubscription':
      return env.FEATURE_TENANT_PROTECT_SUBSCRIPTION === true;
  }
}
