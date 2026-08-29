import Link from 'next/link';
import { notFound } from 'next/navigation';

import { isLocale, type Locale } from '@/i18n/config';
import { requireProfile } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { integrationStatus } from '@/lib/env';
import { Alert, Card, CardHeader } from '@/components/ui/surface';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { monthsOccupied, pairPhotos } from '@/lib/comparison/pairing';
import { roomDisplayName, slotDisplayName } from '@/lib/comparison/labels';
import {
  ComparisonReview,
  type ComparisonView,
  type VetusteOption,
} from '@/components/comparison/comparison-review';
import { AnalyzeButton } from '@/components/comparison/analyze-button';

const COPY: Record<Locale, Record<string, string>> = {
  nl: {
    title: 'Vergelijking intrek — vertrek',
    intro:
      'Elk fotopaar hieronder toont dezelfde plek bij intrek en bij vertrek. ' +
      'Bevestig of corrigeer elke beoordeling: uw oordeel komt in het rapport.',
    noPairs:
      'Er zijn nog geen fotoparen. Dat gebeurt wanneer geen enkele vertrekfoto ' +
      'dezelfde kamer en hetzelfde onderdeel heeft als een intrekfoto.',
    visionOff:
      'Automatische analyse is niet geconfigureerd. U kunt elk fotopaar zelf ' +
      'beoordelen; het rapport werkt daar even goed mee.',
    unmatched: 'Foto’s zonder tegenhanger',
    unmatchedBody:
      'Voor deze foto’s is geen vergelijking mogelijk. Het rapport vermeldt dat.',
    progress: 'Beoordeeld',
    download: 'Vergelijkend rapport downloaden (PDF)',
    reviewFirst:
      'Beoordeel eerst alle fotoparen. Het rapport toont uw oordeel, dus een ' +
      'onbeoordeeld paar zou leeg blijven.',
    back: 'Terug naar het dossier',
  },
  fr: {
    title: 'Comparaison entrée — sortie',
    intro:
      'Chaque paire ci-dessous montre le même endroit à l’entrée et à la ' +
      'sortie. Confirmez ou corrigez chaque appréciation : la vôtre figure ' +
      'dans le rapport.',
    noPairs:
      'Il n’y a pas encore de paires de photos. Cela arrive lorsqu’aucune photo ' +
      'de sortie ne porte la même pièce et le même élément qu’une photo d’entrée.',
    visionOff:
      "L'analyse automatique n'est pas configurée. Vous pouvez évaluer chaque " +
      'paire vous-même ; le rapport fonctionne tout aussi bien.',
    unmatched: 'Photos sans correspondance',
    unmatchedBody:
      'Aucune comparaison n’est possible pour ces photos. Le rapport le mentionne.',
    progress: 'Évaluées',
    download: 'Télécharger le rapport comparatif (PDF)',
    reviewFirst:
      'Évaluez d’abord toutes les paires. Le rapport reprend votre ' +
      'appréciation ; une paire non évaluée resterait vide.',
    back: 'Retour au dossier',
  },
};

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  await requireProfile(locale);
  const t = COPY[locale];

  const supabase = await createSupabaseServerClient();

  const { data: checkOut } = await supabase
    .from('inspections')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!checkOut || checkOut.type !== 'CHECK_OUT') notFound();

  const [{ data: property }, { data: checkIn }] = await Promise.all([
    supabase
      .from('properties')
      .select('*')
      .eq('id', checkOut.property_id)
      .maybeSingle(),
    supabase
      .from('inspections')
      .select('*')
      .eq('property_id', checkOut.property_id)
      .eq('type', 'CHECK_IN')
      .maybeSingle(),
  ]);

  if (!property || !checkIn) notFound();

  const [{ data: checkInPhotos }, { data: checkOutPhotos }, { data: vetuste }] =
    await Promise.all([
      supabase.from('inspection_photos').select('*').eq('inspection_id', checkIn.id),
      supabase.from('inspection_photos').select('*').eq('inspection_id', checkOut.id),
      supabase
        .from('vetuste_reference')
        .select('item_key, label_nl, label_fr, lifetime_years, abattement_pct, category')
        .order('category', { ascending: true }),
    ]);

  const pairing = pairPhotos(checkInPhotos ?? [], checkOutPhotos ?? []);
  const checkOutIds = pairing.pairs.map((pair) => pair.checkOut.id);

  const { data: comparisons } = await supabase
    .from('photo_comparisons')
    .select('*')
    .in(
      'checkout_photo_id',
      checkOutIds.length > 0 ? checkOutIds : ['00000000-0000-0000-0000-000000000000'],
    );

  const signedUrls = new Map<string, string>();
  const allPaths = [
    ...pairing.pairs.map((pair) => pair.checkIn.storage_path),
    ...pairing.pairs.map((pair) => pair.checkOut.storage_path),
  ];

  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('inspection-photos')
      .createSignedUrls(allPaths, 60 * 15);

    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedUrls.set(entry.path, entry.signedUrl);
    }
  }

  const views: ComparisonView[] = pairing.pairs.flatMap((pair) => {
    const row = comparisons?.find(
      (candidate) =>
        candidate.checkin_photo_id === pair.checkIn.id &&
        candidate.checkout_photo_id === pair.checkOut.id,
    );
    if (!row) return [];

    return [
      {
        id: row.id,
        roomLabel: roomDisplayName(pair.room, locale),
        slotLabel: slotDisplayName(pair.label, locale),
        checkInUrl: signedUrls.get(pair.checkIn.storage_path) ?? null,
        checkOutUrl: signedUrls.get(pair.checkOut.storage_path) ?? null,
        checkInUploadedAt: pair.checkIn.uploaded_at,
        checkOutUploadedAt: pair.checkOut.uploaded_at,
        aiClassification: row.ai_classification,
        aiConfidence: row.ai_confidence,
        aiNotes: row.ai_notes,
        aiObservedDifferences: row.ai_observed_differences ?? [],
        aiForcedUnclear: row.ai_forced_unclear,
        aiRefused: row.ai_refused,
        aiSuggestedItemKeys: row.ai_suggested_item_keys ?? [],
        userVerdict: row.user_verdict,
        userNote: row.user_note,
        vetusteItemKey: row.vetuste_item_key,
        equipmentAgeYears: row.equipment_age_at_entry_years,
        repairCostCents: row.repair_cost_cents,
        vetusteAbattementPct: row.vetuste_abattement_pct,
        tenantShareCents: row.tenant_share_cents,
        landlordShareCents: row.landlord_share_cents,
        vetusteExclusion: row.vetuste_exclusion,
      },
    ];
  });

  const vetusteOptions: VetusteOption[] = (vetuste ?? []).map((item) => ({
    itemKey: item.item_key,
    label: locale === 'nl' ? item.label_nl : item.label_fr,
    lifetimeYears: Number(item.lifetime_years),
    abattementPct: Number(item.abattement_pct),
  }));

  const months =
    monthsOccupied(property.lease_start, checkOut.inspection_date) ?? 0;

  const reviewed = views.filter((view) => view.userVerdict !== null).length;
  const allReviewed = views.length > 0 && reviewed === views.length;
  const visionAvailable = integrationStatus('vision') === 'LIVE';

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${locale}/inspections/${id}`}
          className="text-sm text-slate-600 underline underline-offset-2"
        >
          {t.back}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-700">{t.intro}</p>
      </div>

      {!visionAvailable ? (
        <Alert tone="info">
          <p>{t.visionOff}</p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title={`${t.progress}: ${reviewed} / ${views.length}`}
          action={
            visionAvailable ? (
              <AnalyzeButton locale={locale} inspectionId={id} />
            ) : undefined
          }
        />
        {allReviewed ? (
          <a
            href={`/api/inspections/${id}/comparison-report?locale=${locale}`}
            className={cn(buttonVariants({ size: 'lg' }))}
          >
            {t.download}
          </a>
        ) : (
          <p className="text-sm text-slate-600">{t.reviewFirst}</p>
        )}
      </Card>

      {views.length === 0 ? (
        <Alert tone="warning">
          <p>{t.noPairs}</p>
        </Alert>
      ) : (
        <div className="space-y-5">
          {views.map((view) => (
            <ComparisonReview
              key={view.id}
              locale={locale}
              inspectionId={id}
              comparison={view}
              vetusteOptions={vetusteOptions}
              monthsOccupied={months}
            />
          ))}
        </div>
      )}

      {pairing.unmatchedCheckIn.length + pairing.unmatchedCheckOut.length > 0 ? (
        <Alert tone="warning" title={t.unmatched}>
          <p>{t.unmatchedBody}</p>
          <ul className="list-disc pl-5">
            {[...pairing.unmatchedCheckIn, ...pairing.unmatchedCheckOut].map(
              (photo) => (
                <li key={photo.id}>
                  {roomDisplayName(photo.room, locale)} —{' '}
                  {slotDisplayName(photo.label, locale)}
                </li>
              ),
            )}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
