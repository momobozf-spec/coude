'use client';

import { useEffect, useState } from 'react';
import type { Basket, PaymentMethod } from '@superette/contracts';
import { AppShell } from '@/components/app-shell';
import { Alert, Button, Card } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useEuro, useI18n } from '@/lib/i18n';

/**
 * De betaalmethoden, in de volgorde die er in België toe doet.
 *
 * Bancontact bovenaan: het is met afstand de meest gebruikte betaalmethode van
 * het land. Payconiq daarna. Kaart onderaan — een Belg die met kaart betaalt in
 * een winkel doet dat via Bancontact.
 */
const METHODS: Array<{ method: PaymentMethod; label: string }> = [
  { method: 'BANCONTACT', label: 'Bancontact' },
  { method: 'PAYCONIQ', label: 'Payconiq' },
  { method: 'APPLE_PAY', label: 'Apple Pay' },
  { method: 'GOOGLE_PAY', label: 'Google Pay' },
  { method: 'CARD', label: 'Visa / Mastercard' },
];

export default function BasketPage() {
  const { loading } = useRequireAuth();
  const { storeId } = useAuth();
  const { t, locale } = useI18n();
  const euro = useEuro();

  const [basket, setBasket] = useState<Basket | null>(null);
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('BANCONTACT');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!storeId) return;

    api
      .openBasket(storeId)
      .then(setBasket)
      .catch(() => setBasket(null))
      .finally(() => setReady(true));
  }, [storeId]);

  async function changeQuantity(productId: string, quantity: number) {
    if (!basket) return;
    setError(null);

    try {
      setBasket(await api.setQuantity(basket.id, productId, quantity));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Er ging iets mis');
    }
  }

  async function checkout() {
    if (!basket) return;
    setBusy(true);
    setError(null);

    try {
      const { redirectUrl } = await api.checkout({ basketId: basket.id, method });
      // De hosted checkout van Mollie. Volledige navigatie, geen iframe: banken
      // weigeren in een iframe te laden, en terecht.
      window.location.href = redirectUrl;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Er ging iets mis');
      setBusy(false);
    }
  }

  if (loading || !ready) {
    return (
      <AppShell title={t('basket.title')}>
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      </AppShell>
    );
  }

  if (!basket || basket.items.length === 0) {
    return (
      <AppShell title={t('basket.title')}>
        <p className="text-sm text-ink-muted">{t('basket.empty')}</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={t('basket.title')}>
      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}

        <ul className="space-y-3">
          {basket.items.map((item) => (
            <li key={item.id}>
              {/*
                Productnaam op zijn eigen regel, daaronder pas de bediening.
                "Geschenkset “Layali” — Serum & Kaars" past niet naast een
                aantalkiezer én een prijs op 390 pixels; dan wordt het
                "Geschenkset “Lay…" en weet de klant niet wat hij koopt.
              */}
              <Card className="space-y-3">
                <p className="text-sm font-medium leading-snug">{locale === 'fr' ? item.nameFr : item.nameNl}</p>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-muted">
                    {euro(item.unitPriceInclCents)} · {t('basket.vat', { rate: item.vat.replace('VAT_', '') })}
                  </span>

                  <div className="flex items-center gap-1">
                    <QuantityButton label="−" onClick={() => void changeQuantity(item.productId, item.quantity - 1)} />
                    <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
                    <QuantityButton label="+" onClick={() => void changeQuantity(item.productId, item.quantity + 1)} />
                  </div>

                  <span className="w-20 text-right text-sm tabular-nums">
                    {euro(item.unitPriceInclCents * item.quantity)}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        {/*
          De BTW-uitsplitsing staat al in het mandje, niet pas op de kasbon.
          De klant hoort te zien wat hij aan de staat betaalt vóór hij afrekent.
        */}
        <Card testId="totals" className="space-y-2 text-sm">
          <Row label={t('basket.subtotal')} value={euro(basket.totalExclCents)} muted />
          {basket.vatBuckets.map((bucket) => (
            <Row
              key={bucket.code}
              label={t('basket.vat', { rate: bucket.rate })}
              value={euro(bucket.vatCents)}
              muted
            />
          ))}
          <hr className="border-hairline" />
          <Row label={t('basket.total')} value={euro(basket.totalInclCents)} strong />
        </Card>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-xs font-medium uppercase tracking-widest text-ink-muted">
            {t('checkout.method')}
          </legend>

          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((option) => (
              <label
                key={option.method}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-sm transition-colors ${
                  method === option.method ? 'border-accent bg-accent/10 text-ink' : 'border-hairline text-ink-muted'
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={option.method}
                  checked={method === option.method}
                  onChange={() => setMethod(option.method)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Button onClick={() => void checkout()} disabled={busy}>
          {busy ? t('checkout.redirecting') : t('checkout.pay', { amount: euro(basket.totalInclCents) })}
        </Button>
      </div>
    </AppShell>
  );
}

function QuantityButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === '+' ? 'Meer' : 'Minder'}
      className="flex size-8 items-center justify-center rounded-lg border border-hairline text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-strong"
    >
      {label}
    </button>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-ink-muted' : ''}>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-medium text-accent' : muted ? 'text-ink-muted' : ''}`}>{value}</span>
    </div>
  );
}
