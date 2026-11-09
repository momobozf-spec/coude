import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMessages } from '@/i18n';
import { isLocale, type Locale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { PAID_PLANS, purchasablePlans, type PaidPlanKey } from '@/lib/billing/plans';
import { getEnv } from '@/lib/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import { Alert, Card, CardHeader } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Select } from '@/components/ui/field';
import { startCheckoutAction, type CheckoutErrorCode } from './actions';

const ERRORS: Record<CheckoutErrorCode, Record<Locale, string>> = {
  INVALID_INPUT: {
    nl: 'Kies een formule en, voor een pakket, een woning.',
    fr: 'Choisissez une formule et, pour un forfait, un logement.',
  },
  NOT_AVAILABLE: {
    nl: 'Deze formule is momenteel niet te koop.',
    fr: 'Cette formule n’est pas disponible pour le moment.',
  },
  WAIVER_REQUIRED: {
    nl: 'Vink aan dat u om onmiddellijke uitvoering vraagt om verder te gaan.',
    fr: 'Cochez la demande d’exécution immédiate pour continuer.',
  },
  NOT_FOUND: { nl: 'Woning niet gevonden.', fr: 'Logement introuvable.' },
  ALREADY_ACTIVE: {
    nl: 'Deze formule is al actief.',
    fr: 'Cette formule est déjà active.',
  },
  STRIPE_ERROR: {
    nl: 'De betaalpagina kon niet geopend worden. Probeer het later opnieuw.',
    fr: 'La page de paiement n’a pas pu être ouverte. Réessayez plus tard.',
  },
};

function formatAmount(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-BE' : 'fr-BE', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { checkout, error } = await searchParams;

  const profile = await requireProfile(locale);
  const t = getMessages(locale);
  const plans = purchasablePlans(getEnv());

  const supabase = await createSupabaseServerClient();
  const [{ data: pricing }, { data: properties }, { data: entitlements }] =
    await Promise.all([
      supabase.from('pricing_config').select('plan_key, amount_cents, currency, kind'),
      supabase.from('properties').select('id, address, municipality').order('created_at'),
      supabase
        .from('entitlements')
        .select('plan_key, property_id, granted_at')
        .is('revoked_at', null),
    ]);

  const priceOf = (key: PaidPlanKey) => pricing?.find((row) => row.plan_key === key);
  const errorText =
    error && error in ERRORS ? ERRORS[error as CheckoutErrorCode][locale] : null;
  const subscriptionActive =
    profile.subscription_status === 'ACTIVE' || profile.subscription_status === 'TRIALING';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{t.billing.plans}</h1>

      {checkout === 'success' ? (
        <Alert tone="success">
          <p>
            {locale === 'nl'
              ? 'Bedankt. Zodra Stripe de betaling bevestigt, is uw formule actief (meestal binnen enkele seconden; bij Bancontact of overschrijving soms later).'
              : 'Merci. Dès que Stripe confirme le paiement, votre formule est active (généralement en quelques secondes ; parfois plus tard pour Bancontact ou un virement).'}
          </p>
        </Alert>
      ) : null}
      {checkout === 'cancelled' ? (
        <Alert tone="info">
          <p>{locale === 'nl' ? 'Betaling geannuleerd.' : 'Paiement annulé.'}</p>
        </Alert>
      ) : null}
      {errorText ? (
        <Alert tone="critical">
          <p>{errorText}</p>
        </Alert>
      ) : null}

      <p className="text-sm text-slate-700">{t.billing.freeCheckIn}</p>

      {subscriptionActive ? (
        <Alert tone="success" title={t.billing.plan.tenant_protect.name}>
          <p>
            {locale === 'nl' ? 'Actief' : 'Actif'}
            {profile.subscription_current_period_end
              ? ` — ${formatDate(profile.subscription_current_period_end, locale)}`
              : ''}
          </p>
        </Alert>
      ) : null}

      {plans.length === 0 ? (
        <Alert tone="info">
          <p>
            {locale === 'nl'
              ? 'Online betalen is nog niet beschikbaar. Uw gratis intrekdossier werkt wel.'
              : 'Le paiement en ligne n’est pas encore disponible. Votre dossier d’entrée gratuit fonctionne.'}
          </p>
        </Alert>
      ) : null}

      {plans.map((key) => {
        const plan = PAID_PLANS[key];
        const price = priceOf(key);
        const copy = t.billing.plan[key];
        const owned = (entitlements ?? []).filter((row) => row.plan_key === key);

        return (
          <Card key={key}>
            <CardHeader
              title={`${copy.name}${
                price ? ` — ${formatAmount(price.amount_cents, price.currency, locale)}` : ''
              }${plan.kind === 'SUBSCRIPTION' ? (locale === 'nl' ? ' / maand' : ' / mois') : ''}`}
              description={copy.description}
            />

            <form action={startCheckoutAction} className="space-y-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="plan" value={key} />

              {plan.perProperty ? (
                (properties?.length ?? 0) === 0 ? (
                  <p className="text-sm text-slate-600">
                    <Link
                      href={`/${locale}/properties/new`}
                      className="underline underline-offset-2"
                    >
                      {locale === 'nl'
                        ? 'Voeg eerst een woning toe.'
                        : 'Ajoutez d’abord un logement.'}
                    </Link>
                  </p>
                ) : (
                  <Field
                    label={locale === 'nl' ? 'Voor welke woning?' : 'Pour quel logement ?'}
                    htmlFor={`property-${key}`}
                    required
                  >
                    <Select id={`property-${key}`} name="propertyId" required>
                      {properties!.map((property) => (
                        <option
                          key={property.id}
                          value={property.id}
                          disabled={owned.some((row) => row.property_id === property.id)}
                        >
                          {property.address}, {property.municipality}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )
              ) : null}

              <label className="flex items-start gap-3 text-sm text-slate-700">
                <Checkbox name="waiver" required />
                <span>
                  {locale === 'nl'
                    ? 'Ik vraag uitdrukkelijk dat de dienst onmiddellijk start en erken dat ik mijn herroepingsrecht verlies zodra de dienst volledig is uitgevoerd. Ik aanvaard de '
                    : 'Je demande expressément que le service commence immédiatement et je reconnais perdre mon droit de rétractation dès que le service a été entièrement exécuté. J’accepte les '}
                  <Link
                    href={`/${locale}/legal/terms`}
                    className="underline underline-offset-2"
                  >
                    {locale === 'nl' ? 'algemene voorwaarden' : 'conditions générales'}
                  </Link>
                  .
                </span>
              </label>

              <Button
                type="submit"
                size="lg"
                disabled={plan.perProperty && (properties?.length ?? 0) === 0}
              >
                {plan.kind === 'SUBSCRIPTION' ? t.billing.subscribe : t.billing.buy}
              </Button>
            </form>
          </Card>
        );
      })}

      <p className="text-xs text-slate-500">
        {locale === 'nl'
          ? 'Betalingen verlopen via Stripe (kaart, Bancontact). Prijzen inclusief btw.'
          : 'Les paiements passent par Stripe (carte, Bancontact). Prix TVA comprise.'}
      </p>
    </div>
  );
}
