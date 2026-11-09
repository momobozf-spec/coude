'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { ComparePreferences } from '@superette/contracts';
import { AppShell } from '@/components/app-shell';
import { ChainPicker } from '@/components/chain-picker';
import { ErrorState, errorMessage, ListSkeleton } from '@/components/states';
import { Button, Checkbox, Field, LiveRegion, Notice, PageTitle, RadioCards } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { usePreferences } from '@/lib/use-preferences';
import { useAsync } from '@/lib/use-async';

export default function PreferencesPage() {
  const { t } = useI18n();
  const { preferences, loading, isGuest, save } = usePreferences();
  const chains = useAsync(() => api.chains(), []);
  const [draft, setDraft] = useState<ComparePreferences | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading) setDraft(preferences);
  }, [loading, preferences]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await save({ ...draft, postalCode: draft.postalCode || null, municipality: draft.municipality || null });
      setMessage(t('prefs.saved'));
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !draft) {
    return (
      <AppShell>
        <ListSkeleton rows={2} />
      </AppShell>
    );
  }

  const brandPreference: 'none' | 'store' | 'national' = draft.preferStoreBrands ? 'store' : draft.preferNationalBrands ? 'national' : 'none';

  return (
    <AppShell>
      <PageTitle lead={t('prefs.intro')}>{t('prefs.title')}</PageTitle>
      <LiveRegion message={message} />
      {isGuest && <Notice tone="info" className="mb-4">{t('prefs.guestNote')}</Notice>}
      {message && <Notice tone="success" className="mb-4">{message}</Notice>}
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}
      {chains.error ? <ErrorState error={chains.error} onRetry={chains.reload} /> : null}

      <form onSubmit={submit} className="space-y-6" noValidate>
        {chains.data && (
          <>
            <ChainPicker name="enabled" legend={t('prefs.enabledChains')} hint={t('prefs.enabledChains.hint')} chains={chains.data} selected={draft.enabledChainSlugs} onChange={(enabledChainSlugs) => setDraft({ ...draft, enabledChainSlugs })} />
            <ChainPicker name="favorites" legend={t('prefs.favorites')} chains={chains.data} selected={draft.favoriteChainSlugs} onChange={(favoriteChainSlugs) => setDraft({ ...draft, favoriteChainSlugs })} />
            <ChainPicker name="loyalty" legend={t('prefs.loyaltyCards')} chains={chains.data.filter((chain) => chain.loyaltyCardName)} selected={draft.loyaltyCardChainSlugs} onChange={(loyaltyCardChainSlugs) => setDraft({ ...draft, loyaltyCardChainSlugs })} />
          </>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('prefs.postalCode')} name="postalCode" inputMode="numeric" pattern="[1-9][0-9]{3}" maxLength={4} value={draft.postalCode ?? ''} onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })} />
          <Field label={t('prefs.municipality')} name="municipality" value={draft.municipality ?? ''} onChange={(e) => setDraft({ ...draft, municipality: e.target.value })} maxLength={80} />
          <Field
            label={t('prefs.maxDistance')}
            name="maxDistanceKm"
            inputMode="numeric"
            hint={t('prefs.maxDistance.hint')}
            value={draft.maxDistanceKm ?? ''}
            onChange={(e) => setDraft({ ...draft, maxDistanceKm: e.target.value ? Math.min(200, Math.max(1, Number(e.target.value) || 1)) : null })}
          />
        </div>

        <RadioCards<'none' | 'store' | 'national'>
          name="brandPreference"
          legend={t('prefs.brandPreference')}
          value={brandPreference}
          onChange={(value) => setDraft({ ...draft, preferStoreBrands: value === 'store', preferNationalBrands: value === 'national' })}
          options={[
            { value: 'none', label: t('prefs.brand.none') },
            { value: 'store', label: t('prefs.brand.store') },
            { value: 'national', label: t('prefs.brand.national') },
          ]}
        />

        <div>
          <Checkbox label={t('prefs.allowAlternatives')} checked={draft.allowAlternatives} onChange={(e) => setDraft({ ...draft, allowAlternatives: e.target.checked })} />
          <Checkbox label={t('prefs.includePersonalized')} checked={draft.includePersonalizedOffers} onChange={(e) => setDraft({ ...draft, includePersonalizedOffers: e.target.checked })} />
          <Checkbox label={t('prefs.includeOnline')} checked={draft.includeOnlineOffers} onChange={(e) => setDraft({ ...draft, includeOnlineOffers: e.target.checked })} />
          {!isGuest && (
            <Checkbox label={t('prefs.emailNotifications')} hint={t('prefs.emailNotifications.hint')} checked={draft.emailNotifications} onChange={(e) => setDraft({ ...draft, emailNotifications: e.target.checked })} />
          )}
        </div>

        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t('common.loading') : t('common.save')}
        </Button>
      </form>
    </AppShell>
  );
}
