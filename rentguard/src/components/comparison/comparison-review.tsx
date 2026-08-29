'use client';

import Image from 'next/image';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import type { Locale } from '@/i18n/config';
import type { DamageClassification } from '@/lib/supabase/types';
import {
  saveVerdictAction,
  saveVetusteAction,
  type ComparisonState,
} from '@/app/[locale]/(app)/inspections/[id]/comparison/actions';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { formatEuroCents } from '@/lib/utils';

const INITIAL: ComparisonState = { error: null };

export interface ComparisonView {
  id: string;
  roomLabel: string;
  slotLabel: string;
  checkInUrl: string | null;
  checkOutUrl: string | null;
  checkInUploadedAt: string;
  checkOutUploadedAt: string;
  aiClassification: DamageClassification | null;
  aiConfidence: number | null;
  aiNotes: string | null;
  aiObservedDifferences: string[];
  aiForcedUnclear: boolean;
  aiRefused: boolean;
  aiSuggestedItemKeys: string[];
  userVerdict: DamageClassification | null;
  userNote: string | null;
  vetusteItemKey: string | null;
  equipmentAgeYears: number | null;
  repairCostCents: number | null;
  vetusteAbattementPct: number | null;
  tenantShareCents: number | null;
  landlordShareCents: number | null;
  vetusteExclusion: string | null;
}

export interface VetusteOption {
  itemKey: string;
  label: string;
  lifetimeYears: number;
  abattementPct: number;
}

const COPY = {
  nl: {
    checkIn: 'Bij intrek',
    checkOut: 'Bij vertrek',
    aiAnalysis: 'AI-analyse',
    notAnalyzed:
      'Dit fotopaar is niet automatisch geanalyseerd. Beoordeel het zelf.',
    refused:
      'De automatische analyse kon dit fotopaar niet beoordelen. Beoordeel het zelf.',
    forcedUnclear:
      'De analyse was te onzeker om een uitspraak te doen en is daarom op ' +
      'onduidelijk gezet.',
    confidence: 'Zekerheid',
    observed: 'Waargenomen verschillen',
    aiIsNotAVerdict:
      'Dit is een hulpmiddel, geen vaststelling. Uw oordeel komt in het ' +
      'rapport; de analyse komt in de bijlage.',
    yourVerdict: 'Uw oordeel',
    note: 'Uw toelichting',
    save: 'Oordeel bewaren',
    saved: 'Bewaard',
    saving: 'Bezig…',
    classification: {
      WEAR_AND_TEAR: 'Normale slijtage',
      DAMAGE: 'Schade',
      UNCLEAR: 'Onduidelijk',
    },
    vetusteTitle: 'Kostenverdeling volgens de slijtagegrille',
    vetusteIntro:
      'Vul een herstelkost in uit een offerte. Wij verdelen die volgens de ' +
      'Waalse indicatieve slijtagegrille.',
    vetusteWarning:
      'Deze verdeling volgt het Waalse indicatieve slijtagerooster. Er bestaat ' +
      'geen Brussels equivalent. Een Brusselse rechter is hier niet aan gebonden.',
    item: 'Onderdeel',
    itemPlaceholder: 'Kies een onderdeel',
    ageAtEntry: 'Leeftijd bij uw intrek (jaren)',
    ageHint:
      'Weet u dit niet, vraag het aan uw verhuurder. Bij twijfel: laat op nul ' +
      'staan; dat is het minst gunstig voor u, dus u overschat uw aandeel niet.',
    repairCost: 'Herstelkost volgens offerte (EUR)',
    exclusion: 'De grille geldt niet omdat…',
    exclusionNone: 'De grille is van toepassing',
    calculate: 'Verdeling berekenen',
    lifetime: 'Levensduur',
    years: 'jaar',
    perYear: 'per jaar',
    abattement: 'Toegepaste afschrijving',
    tenantShare: 'Uw aandeel',
    landlordShare: 'Aandeel verhuurder',
    noCostBasis:
      'Vul een herstelkost in. Zonder bedrag berekenen wij niets — een ' +
      'verdeling van een onbekend bedrag is een verzonnen bedrag.',
    errorGeneric: 'Er ging iets mis. Probeer het opnieuw.',
    suggested: 'Voorgesteld door de analyse',
  },
  fr: {
    checkIn: "À l'entrée",
    checkOut: 'À la sortie',
    aiAnalysis: 'Analyse IA',
    notAnalyzed:
      "Cette paire de photos n'a pas été analysée automatiquement. Évaluez-la " +
      'vous-même.',
    refused:
      "L'analyse automatique n'a pas pu évaluer cette paire de photos. " +
      'Évaluez-la vous-même.',
    forcedUnclear:
      "L'analyse était trop incertaine pour conclure et a donc été placée sur " +
      'incertain.',
    confidence: 'Certitude',
    observed: 'Différences observées',
    aiIsNotAVerdict:
      "C'est un outil d'aide, pas une constatation. Votre appréciation figure " +
      "dans le rapport ; l'analyse figure en annexe.",
    yourVerdict: 'Votre appréciation',
    note: 'Votre commentaire',
    save: 'Enregistrer',
    saved: 'Enregistré',
    saving: 'En cours…',
    classification: {
      WEAR_AND_TEAR: 'Usure normale',
      DAMAGE: 'Dégât',
      UNCLEAR: 'Incertain',
    },
    vetusteTitle: 'Répartition du coût selon la grille de vétusté',
    vetusteIntro:
      'Indiquez un coût de réparation issu d’un devis. Nous le répartissons ' +
      'selon la grille indicative wallonne de vétusté.',
    vetusteWarning:
      'Cette répartition suit la grille indicative wallonne de vétusté. Il ' +
      "n'existe pas d'équivalent bruxellois. Un juge bruxellois n'y est pas lié.",
    item: 'Élément',
    itemPlaceholder: 'Choisissez un élément',
    ageAtEntry: 'Âge à votre entrée (années)',
    ageHint:
      'Si vous ne le savez pas, demandez-le à votre bailleur. En cas de doute : ' +
      "laissez à zéro ; c'est le moins favorable pour vous, vous ne surestimez " +
      'donc pas votre part.',
    repairCost: 'Coût de réparation selon devis (EUR)',
    exclusion: 'La grille ne s’applique pas car…',
    exclusionNone: 'La grille s’applique',
    calculate: 'Calculer la répartition',
    lifetime: 'Durée de vie',
    years: 'ans',
    perYear: 'par an',
    abattement: 'Abattement appliqué',
    tenantShare: 'Votre part',
    landlordShare: 'Part du bailleur',
    noCostBasis:
      'Indiquez un coût de réparation. Sans montant nous ne calculons rien — ' +
      "répartir un montant inconnu revient à inventer un montant.",
    errorGeneric: 'Une erreur est survenue. Réessayez.',
    suggested: "Suggéré par l'analyse",
  },
} as const;

const EXCLUSIONS = [
  'VOLUNTARY_DAMAGE',
  'VANDALISM',
  'ABUSIVE_USE',
  'HYGIENE_FAILURE',
  'UNAUTHORISED_TRANSFORMATION',
  'LOST_OR_REMOVED_EQUIPMENT',
  'TENANT_LIABILITY_ESTABLISHED',
  'TENANT_MAY_REDECORATE_FREELY',
] as const;

const EXCLUSION_COPY: Record<
  (typeof EXCLUSIONS)[number],
  { nl: string; fr: string }
> = {
  VOLUNTARY_DAMAGE: {
    nl: 'Opzettelijke beschadiging',
    fr: 'Dégradation volontaire',
  },
  VANDALISM: { nl: 'Vandalisme', fr: 'Vandalisme' },
  ABUSIVE_USE: { nl: 'Abusief gebruik', fr: 'Usage abusif' },
  HYGIENE_FAILURE: {
    nl: 'Gebrek aan hygiëne',
    fr: "Défaut d'hygiène",
  },
  UNAUTHORISED_TRANSFORMATION: {
    nl: 'Verbouwing zonder toestemming',
    fr: 'Transformation sans autorisation',
  },
  LOST_OR_REMOVED_EQUIPMENT: {
    nl: 'Uitrusting verloren of verwijderd',
    fr: 'Équipement perdu ou retiré',
  },
  TENANT_LIABILITY_ESTABLISHED: {
    nl: 'Aansprakelijkheid huurder staat vast',
    fr: 'Responsabilité du locataire établie',
  },
  TENANT_MAY_REDECORATE_FREELY: {
    nl: 'Huurder mocht vrij herschilderen',
    fr: 'Le locataire pouvait repeindre librement',
  },
};

function SaveButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function ComparisonReview({
  locale,
  inspectionId,
  comparison,
  vetusteOptions,
  monthsOccupied,
}: {
  locale: Locale;
  inspectionId: string;
  comparison: ComparisonView;
  vetusteOptions: VetusteOption[];
  monthsOccupied: number;
}) {
  const t = COPY[locale];
  const [verdictState, verdictAction] = useActionState(
    saveVerdictAction,
    INITIAL,
  );
  const [vetusteState, vetusteAction] = useActionState(
    saveVetusteAction,
    INITIAL,
  );

  const [verdict, setVerdict] = useState<DamageClassification>(
    comparison.userVerdict ?? comparison.aiClassification ?? 'UNCLEAR',
  );

  const suggested = comparison.aiSuggestedItemKeys[0] ?? '';

  return (
    <Card>
      <h3 className="mb-1 font-semibold text-slate-900">
        {comparison.roomLabel} — {comparison.slotLabel}
      </h3>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <PhotoPanel
          title={t.checkIn}
          url={comparison.checkInUrl}
          alt={`${t.checkIn}: ${comparison.roomLabel} ${comparison.slotLabel}`}
        />
        <PhotoPanel
          title={t.checkOut}
          url={comparison.checkOutUrl}
          alt={`${t.checkOut}: ${comparison.roomLabel} ${comparison.slotLabel}`}
        />
      </div>

      <section className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{t.aiAnalysis}</h4>
          {comparison.aiClassification ? (
            <Badge
              tone={
                comparison.aiClassification === 'DAMAGE'
                  ? 'critical'
                  : comparison.aiClassification === 'WEAR_AND_TEAR'
                    ? 'verified'
                    : 'unverified'
              }
            >
              {t.classification[comparison.aiClassification]}
            </Badge>
          ) : null}
          {comparison.aiConfidence !== null ? (
            <span className="text-xs text-slate-600">
              {t.confidence}: {Math.round(comparison.aiConfidence * 100)}%
            </span>
          ) : null}
        </div>

        {comparison.aiRefused ? (
          <p className="text-sm text-slate-700">{t.refused}</p>
        ) : !comparison.aiClassification ? (
          <p className="text-sm text-slate-700">{t.notAnalyzed}</p>
        ) : (
          <>
            {comparison.aiForcedUnclear ? (
              <p className="mb-2 text-sm text-amber-800">{t.forcedUnclear}</p>
            ) : null}
            {comparison.aiNotes ? (
              <p className="text-sm text-slate-700">{comparison.aiNotes}</p>
            ) : null}
            {comparison.aiObservedDifferences.length > 0 ? (
              <>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t.observed}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                  {comparison.aiObservedDifferences.map((difference) => (
                    <li key={difference}>{difference}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}

        <p className="mt-3 text-xs text-slate-600">{t.aiIsNotAVerdict}</p>
      </section>

      <form action={verdictAction} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="comparisonId" value={comparison.id} />
        <input type="hidden" name="inspectionId" value={inspectionId} />

        {verdictState.error ? (
          <Alert tone="critical">
            <p>{t.errorGeneric}</p>
          </Alert>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-900">
            {t.yourVerdict}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(['WEAR_AND_TEAR', 'DAMAGE', 'UNCLEAR'] as const).map((option) => (
              <label
                key={option}
                className={[
                  'cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium',
                  verdict === option
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="verdict"
                  value={option}
                  checked={verdict === option}
                  onChange={() => setVerdict(option)}
                  className="sr-only"
                />
                {t.classification[option]}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t.note} htmlFor={`note-${comparison.id}`}>
          <Textarea
            name="note"
            defaultValue={comparison.userNote ?? ''}
            rows={2}
          />
        </Field>

        <div className="flex items-center gap-3">
          <SaveButton label={t.save} busy={t.saving} />
          {verdictState.savedId === comparison.id ? (
            <span className="text-sm text-emerald-700">{t.saved}</span>
          ) : comparison.userVerdict ? (
            <span className="text-sm text-emerald-700">{t.saved}</span>
          ) : null}
        </div>
      </form>

      {verdict === 'DAMAGE' ? (
        <section className="mt-5 border-t border-slate-200 pt-5">
          <h4 className="mb-1 text-sm font-semibold text-slate-900">
            {t.vetusteTitle}
          </h4>
          <p className="mb-3 text-sm text-slate-600">{t.vetusteIntro}</p>

          <Alert tone="warning" className="mb-4">
            <p>{t.vetusteWarning}</p>
          </Alert>

          <form action={vetusteAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="comparisonId" value={comparison.id} />
            <input type="hidden" name="inspectionId" value={inspectionId} />
            <input type="hidden" name="monthsOccupied" value={monthsOccupied} />

            {vetusteState.error ? (
              <Alert tone="critical">
                <p>
                  {vetusteState.error === 'NO_COST_BASIS'
                    ? t.noCostBasis
                    : t.errorGeneric}
                </p>
              </Alert>
            ) : null}

            <Field label={t.item} htmlFor={`item-${comparison.id}`} required>
              <Select
                name="itemKey"
                defaultValue={comparison.vetusteItemKey ?? suggested}
                required
              >
                <option value="">{t.itemPlaceholder}</option>
                {vetusteOptions.map((option) => (
                  <option key={option.itemKey} value={option.itemKey}>
                    {option.label} — {option.lifetimeYears} {t.years},{' '}
                    {option.abattementPct}% {t.perYear}
                    {option.itemKey === suggested ? ` (${t.suggested})` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t.ageAtEntry}
                htmlFor={`age-${comparison.id}`}
                hint={t.ageHint}
              >
                <Input
                  name="equipmentAgeYears"
                  inputMode="decimal"
                  defaultValue={comparison.equipmentAgeYears?.toString() ?? '0'}
                />
              </Field>

              <Field
                label={t.repairCost}
                htmlFor={`cost-${comparison.id}`}
                required
              >
                <Input
                  name="repairCost"
                  inputMode="decimal"
                  defaultValue={
                    comparison.repairCostCents !== null
                      ? (comparison.repairCostCents / 100).toFixed(2)
                      : ''
                  }
                  required
                />
              </Field>
            </div>

            <Field label={t.exclusion} htmlFor={`excl-${comparison.id}`}>
              <Select
                name="exclusion"
                defaultValue={comparison.vetusteExclusion ?? ''}
              >
                <option value="">{t.exclusionNone}</option>
                {EXCLUSIONS.map((exclusion) => (
                  <option key={exclusion} value={exclusion}>
                    {EXCLUSION_COPY[exclusion][locale]}
                  </option>
                ))}
              </Select>
            </Field>

            <SaveButton label={t.calculate} busy={t.saving} />
          </form>

          {comparison.tenantShareCents !== null &&
          comparison.landlordShareCents !== null ? (
            <dl className="mt-4 space-y-1 rounded-lg border border-slate-200 p-3 text-sm">
              {comparison.vetusteAbattementPct !== null ? (
                <div className="flex justify-between">
                  <dt className="text-slate-600">{t.abattement}</dt>
                  <dd className="font-medium">
                    {comparison.vetusteAbattementPct}%
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-slate-600">{t.tenantShare}</dt>
                <dd className="font-semibold text-slate-900">
                  {formatEuroCents(comparison.tenantShareCents, locale)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">{t.landlordShare}</dt>
                <dd className="font-semibold text-slate-900">
                  {formatEuroCents(comparison.landlordShareCents, locale)}
                </dd>
              </div>
            </dl>
          ) : null}
        </section>
      ) : null}
    </Card>
  );
}

function PhotoPanel({
  title,
  url,
  alt,
}: {
  title: string;
  url: string | null;
  alt: string;
}) {
  return (
    <figure>
      <figcaption className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </figcaption>
      {url ? (
        <Image
          src={url}
          alt={alt}
          width={800}
          height={600}
          unoptimized
          className="h-auto w-full rounded-lg border border-slate-200 object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
          —
        </div>
      )}
    </figure>
  );
}
