'use client';

/**
 * Prijsalert instellen of bewerken, met live preview: huidige laagste prijs,
 * verschil tot het doel, een menselijke bevestigingszin en duplicaatdetectie.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { AlertComparisonType, AlertMatchPreference, AlertPreview, CatalogProductSummary, CreatePriceAlertInput, NotificationChannel, PriceAlert, StoreChain } from '@superette/contracts';
import { perUnitLabel } from '@superette/pricing';
import { api, ApiError } from '@/lib/api';
import { centsToEuroInput, euroInputToCents, formatEuro, formatUnitPrice } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ChainPicker } from './chain-picker';
import { OfferRow } from './price';
import { errorMessage } from './states';
import { Button, Checkbox, Field, Notice, RadioCards, SelectField } from './ui';

interface FormState {
  comparisonType: AlertComparisonType;
  matchPreference: AlertMatchPreference;
  allChains: boolean;
  chainSlugs: string[];
  targetPrice: string;
  minimumDiscount: string;
  channel: NotificationChannel;
  includeLoyalty: boolean;
  includePersonalized: boolean;
  includeOnline: boolean;
}

function initialState(existing: PriceAlert | null, suggestedCents: number | null): FormState {
  return {
    comparisonType: existing?.comparisonType ?? 'PACKAGE_PRICE',
    matchPreference: existing?.matchPreference ?? 'EXACT',
    allChains: existing ? existing.chains.length === 0 : true,
    chainSlugs: existing?.chains.map((chain) => chain.slug) ?? [],
    targetPrice: centsToEuroInput(existing?.targetPriceCents ?? suggestedCents),
    minimumDiscount: existing?.minimumDiscountPercentage ? String(existing.minimumDiscountPercentage) : '',
    channel: existing?.notificationChannel ?? 'IN_APP',
    includeLoyalty: existing?.includeLoyaltyOffers ?? true,
    includePersonalized: existing?.includePersonalizedOffers ?? false,
    includeOnline: existing?.includeOnlineOffers ?? true,
  };
}

export function AlertForm({
  product,
  chains,
  existing,
  suggestedCents,
}: {
  product: CatalogProductSummary;
  chains: StoreChain[];
  existing: PriceAlert | null;
  /** Voorstel voor de doelprijs: iets onder de huidige laagste prijs. */
  suggestedCents: number | null;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(existing, suggestedCents));
  const [preview, setPreview] = useState<AlertPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const targetCents = euroInputToCents(form.targetPrice);
  const discount = Number(form.minimumDiscount);
  const priceInvalid = form.comparisonType !== 'DISCOUNT_PERCENTAGE' && (targetCents === null || targetCents <= 0);
  const discountInvalid = form.comparisonType === 'DISCOUNT_PERCENTAGE' && (!Number.isInteger(discount) || discount < 1 || discount > 99);
  const unitNotComparable = form.comparisonType === 'UNIT_PRICE' && product.normalizedUnit === null;

  const input = useMemo<CreatePriceAlertInput | null>(() => {
    if (priceInvalid || discountInvalid || unitNotComparable) return null;
    return {
      catalogProductId: product.id,
      comparisonType: form.comparisonType,
      matchPreference: form.matchPreference,
      chainSlugs: form.allChains ? [] : form.chainSlugs,
      ...(form.comparisonType === 'DISCOUNT_PERCENTAGE' ? { minimumDiscountPercentage: discount } : { targetPriceCents: targetCents ?? 0 }),
      notificationChannel: form.channel,
      includeLoyaltyOffers: form.includeLoyalty,
      includePersonalizedOffers: form.includePersonalized,
      includeOnlineOffers: form.includeOnline,
    };
  }, [form, product.id, priceInvalid, discountInvalid, unitNotComparable, targetCents, discount]);

  // Preview met een korte vertraging, zodat we niet bij elke toetsaanslag de API vragen.
  useEffect(() => {
    if (!input) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .alertPreview(input)
        .then((result) => {
          setPreview(result);
          setPreviewError(null);
        })
        .catch((cause) => setPreviewError(errorMessage(cause, t)));
    }, 400);
    return () => clearTimeout(timer);
  }, [input, t]);

  const duplicateOfOther = preview?.duplicateOfAlertId && preview.duplicateOfAlertId !== existing?.id ? preview.duplicateOfAlertId : null;

  async function submit() {
    if (!input) return;
    setBusy(true);
    setSubmitError(null);
    setDuplicateId(null);
    try {
      if (existing) {
        await api.updateAlert(existing.id, {
          comparisonType: input.comparisonType,
          matchPreference: input.matchPreference,
          chainSlugs: input.chainSlugs,
          ...(input.targetPriceCents !== undefined ? { targetPriceCents: input.targetPriceCents } : {}),
          ...(input.minimumDiscountPercentage !== undefined ? { minimumDiscountPercentage: input.minimumDiscountPercentage } : {}),
          notificationChannel: input.notificationChannel,
          includeLoyaltyOffers: input.includeLoyaltyOffers,
          includePersonalizedOffers: input.includePersonalizedOffers,
          includeOnlineOffers: input.includeOnlineOffers,
        });
        router.push('/alerts?melding=bijgewerkt');
      } else {
        await api.createAlert(input);
        router.push('/alerts?melding=aangemaakt');
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'DUPLICATE_ALERT' && typeof cause.extra?.['existingAlertId'] === 'string') {
        setDuplicateId(cause.extra['existingAlertId']);
      } else if (cause instanceof ApiError && cause.code === 'NOT_COMPARABLE') {
        setSubmitError(t('alerts.form.notComparable'));
      } else {
        setSubmitError(errorMessage(cause, t));
      }
      setBusy(false);
    }
  }

  const unitLabel = product.normalizedUnit ? perUnitLabel(product.normalizedUnit, locale) : '';
  const comparedLabel = (value: number): string =>
    form.comparisonType === 'DISCOUNT_PERCENTAGE' ? `${value}%` : form.comparisonType === 'UNIT_PRICE' && product.normalizedUnit ? formatUnitPrice(value, product.normalizedUnit, locale) : formatEuro(value, locale);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="space-y-6"
      noValidate
    >
      <div className="rounded-xl border border-hairline bg-canvas-raised p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t('alerts.form.product')}</p>
        <p className="font-bold text-ink">
          {product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : ''}
          {product.name} <span className="font-normal text-ink-muted">· {product.packageLabel}</span>
        </p>
      </div>

      <RadioCards<AlertComparisonType>
        name="comparisonType"
        legend={t('alerts.form.comparison')}
        value={form.comparisonType}
        onChange={(comparisonType) => setForm({ ...form, comparisonType })}
        options={[
          { value: 'PACKAGE_PRICE', label: t('alerts.form.comparison.PACKAGE_PRICE') },
          { value: 'UNIT_PRICE', label: t('alerts.form.comparison.UNIT_PRICE'), disabled: product.normalizedUnit === null, description: product.normalizedUnit === null ? t('alerts.form.notComparable') : undefined },
          { value: 'DISCOUNT_PERCENTAGE', label: t('alerts.form.comparison.DISCOUNT_PERCENTAGE') },
        ]}
      />

      {form.comparisonType === 'DISCOUNT_PERCENTAGE' ? (
        <Field
          label={t('alerts.form.discount')}
          name="minimumDiscount"
          inputMode="numeric"
          value={form.minimumDiscount}
          onChange={(event) => setForm({ ...form, minimumDiscount: event.target.value })}
          error={form.minimumDiscount !== '' && discountInvalid ? t('alerts.form.invalidDiscount') : undefined}
          required
        />
      ) : (
        <Field
          label={form.comparisonType === 'UNIT_PRICE' ? t('alerts.form.target.unit', { unit: unitLabel }) : t('alerts.form.target')}
          name="targetPrice"
          inputMode="decimal"
          placeholder="1,79"
          value={form.targetPrice}
          onChange={(event) => setForm({ ...form, targetPrice: event.target.value })}
          error={form.targetPrice !== '' && priceInvalid ? t('alerts.form.invalidPrice') : undefined}
          required
        />
      )}

      <RadioCards<AlertMatchPreference>
        name="matchPreference"
        legend={t('alerts.form.match')}
        value={form.matchPreference}
        onChange={(matchPreference) => setForm({ ...form, matchPreference })}
        options={[
          { value: 'EXACT', label: t('alerts.form.match.EXACT') },
          { value: 'EQUIVALENT', label: t('alerts.form.match.EQUIVALENT') },
          { value: 'ALTERNATIVE', label: t('alerts.form.match.ALTERNATIVE') },
        ]}
      />

      <div className="space-y-2">
        <RadioCards<'all' | 'pick'>
          name="chainMode"
          legend={t('alerts.form.chains')}
          value={form.allChains ? 'all' : 'pick'}
          onChange={(mode) => setForm({ ...form, allChains: mode === 'all' })}
          options={[
            { value: 'all', label: t('alerts.form.chains.all') },
            { value: 'pick', label: t('alerts.form.chains.pick') },
          ]}
        />
        {!form.allChains && <ChainPicker name="chains" legend={t('search.filters.chains')} chains={chains} selected={form.chainSlugs} onChange={(chainSlugs) => setForm({ ...form, chainSlugs })} />}
      </div>

      <div className="space-y-1">
        <Checkbox label={t('alerts.form.includeLoyalty')} checked={form.includeLoyalty} onChange={(e) => setForm({ ...form, includeLoyalty: e.target.checked })} />
        <Checkbox label={t('alerts.form.includePersonalized')} checked={form.includePersonalized} onChange={(e) => setForm({ ...form, includePersonalized: e.target.checked })} />
        <Checkbox label={t('alerts.form.includeOnline')} checked={form.includeOnline} onChange={(e) => setForm({ ...form, includeOnline: e.target.checked })} />
      </div>

      <SelectField label={t('alerts.form.channel')} name="channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as NotificationChannel })}>
        <option value="IN_APP">{t('alerts.form.channel.IN_APP')}</option>
        <option value="EMAIL" disabled>
          {t('alerts.form.channel.EMAIL')}
        </option>
      </SelectField>

      {/* Preview */}
      <section aria-live="polite" className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-4">
        <h2 className="text-sm font-bold text-ink">{t('alerts.form.preview')}</h2>
        {unitNotComparable && <Notice tone="warning" className="mt-2">{t('alerts.form.notComparable')}</Notice>}
        {previewError && <Notice tone="danger" className="mt-2">{previewError}</Notice>}
        {preview && (
          <div className="mt-2 space-y-3 text-sm">
            <p className="text-ink">{preview.sentence}</p>
            {preview.currentLowest ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('alerts.form.preview.current')}</p>
                <OfferRow offer={preview.currentLowest.offer} compact />
                {preview.differenceCents !== null && (
                  <p className={`text-sm font-semibold ${preview.differenceCents <= 0 ? 'text-accent-strong' : 'text-ink'}`}>
                    {preview.differenceCents <= 0
                      ? t('alerts.difference.below', { amount: formatEuro(Math.abs(preview.differenceCents), locale) })
                      : t('alerts.difference.above', { amount: formatEuro(preview.differenceCents, locale) })}
                    {preview.differencePercentage !== null && ` (${preview.differencePercentage > 0 ? '+' : ''}${preview.differencePercentage}%)`}
                  </p>
                )}
                {preview.differenceCents === null && form.comparisonType === 'DISCOUNT_PERCENTAGE' && preview.differencePercentage !== null && (
                  <p className="text-sm font-semibold text-ink">
                    {preview.differencePercentage <= 0 ? t('alerts.difference.discountReached', { percent: comparedLabel(preview.currentLowest.comparedValue).replace('%', '') }) : t('alerts.difference.discountAbove', { percent: preview.differencePercentage })}
                  </p>
                )}
                {preview.differenceCents !== null && preview.differenceCents <= 0 && <p className="text-xs text-ink-muted">{t('alerts.form.preview.alreadyReached')}</p>}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">{t('alerts.form.preview.noPrice')}</p>
            )}
          </div>
        )}
      </section>

      {(duplicateOfOther || duplicateId) && (
        <Notice tone="warning">
          {t('alerts.form.duplicate')}{' '}
          <Link href={`/alerts/${duplicateId ?? duplicateOfOther}`} className="font-semibold underline underline-offset-2">
            {t('alerts.form.duplicate.edit')}
          </Link>
        </Notice>
      )}
      {submitError && <Notice tone="danger">{submitError}</Notice>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !input || !!duplicateOfOther} size="lg">
          {busy ? t('common.loading') : existing ? t('alerts.form.update') : t('alerts.form.submit')}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
