import { getLocales } from 'expo-localization';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ComparisonUnit } from '@superrette/shared';
import type { Locale, PromotionParams } from '@superrette/domain';
import {
  createTranslator,
  formatDate,
  formatPrice,
  formatUnitPrice,
  resolveLocale,
  type MessageKey,
  type Translate,
  type TranslateParams,
} from '@superrette/i18n';
import { useSession } from './session';

interface I18nValue {
  locale: Locale;
  country: string;
  t: Translate;
  setLocale(locale: Locale): void;
  price(cents: number): string;
  unitPrice(u: { cents: number; per: ComparisonUnit } | null | undefined): string | null;
  date(iso: string | Date, style?: 'short' | 'medium' | 'long'): string;
  promotion(params: PromotionParams): string;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Locale: the user's profile language, else the device language, else Dutch. */
export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const { user } = useSession();
  const device = resolveLocale(getLocales()[0]?.languageCode ?? 'nl');
  const [override, setOverride] = useState<Locale | null>(null);
  const locale = override ?? user?.locale ?? device;
  const country = user?.countryCode ?? getLocales()[0]?.regionCode ?? 'BE';

  const value = useMemo<I18nValue>(() => {
    const t = createTranslator(locale);
    const opts = { locale, country };
    const price = (cents: number): string => formatPrice(cents, opts);
    return {
      locale,
      country,
      t,
      setLocale: setOverride,
      price,
      unitPrice: (u) => (u ? formatUnitPrice(u.cents, u.per, opts) : null),
      date: (iso, style = 'medium') => formatDate(iso, { ...opts, style }),
      promotion: (p) => {
        const params: TranslateParams = { ...(p as unknown as Record<string, number>) };
        if (p.mechanic === 'PRICE_CUT') params.price = price(p.promoPriceCents);
        if (p.mechanic === 'MULTI_BUY_FIXED_PRICE') params.price = price(p.totalCents);
        if (p.mechanic === 'AMOUNT_OFF') params.amount = price(p.amountCents);
        return t(`promotions.mechanic.${p.mechanic}` as MessageKey, params);
      },
    };
  }, [locale, country]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
