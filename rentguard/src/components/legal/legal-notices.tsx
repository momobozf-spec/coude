import type { Locale } from '@/i18n/config';
import { format, getMessages } from '@/i18n';
import type { LegalRuleStatus } from '@/lib/supabase/types';
import type { RuleSnapshotEntry } from '@/lib/legal/rules';
import { Alert, Badge } from '@/components/ui/surface';
import { formatDate } from '@/lib/utils';

/**
 * Componenten die de juridische eerlijkheid van het product dragen.
 *
 * Ze staan bij elkaar zodat er één plek is waar te controleren valt dat de
 * disclaimer, de bronvermelding en de verificatiestatus consistent getoond
 * worden. Zie docs/decisions/0003-bewijswaarde-framing.md.
 */

export function DisclaimerNotice({ locale }: { locale: Locale }) {
  const t = getMessages(locale);

  return (
    <Alert tone="info" title={t.legal.notLegalAdvice}>
      <p>{t.legal.disclaimer}</p>
    </Alert>
  );
}

const STATUS_TONE: Record<LegalRuleStatus, 'verified' | 'unverified' | 'stale'> = {
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
  STALE: 'stale',
};

export function RuleStatusBadge({
  status,
  locale,
}: {
  status: LegalRuleStatus;
  locale: Locale;
}) {
  const t = getMessages(locale);
  return <Badge tone={STATUS_TONE[status]}>{t.legalStatus[status]}</Badge>;
}

/**
 * Toont welke regels een uitkomst dragen, met hun bron en status.
 *
 * Dit is geen optionele "meer info"-blok: een gebruiker die op een berekening
 * afgaat, moet kunnen zien waar die vandaan komt en hoe zeker ze is.
 */
export function RuleSourceList({
  snapshot,
  locale,
}: {
  snapshot: Record<string, RuleSnapshotEntry>;
  locale: Locale;
}) {
  const t = getMessages(locale);
  const entries = Object.values(snapshot);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">
        {t.legalStatus.sourceLabel}
      </h3>
      <ul className="space-y-3">
        {entries.map((entry) => (
          <li
            key={entry.rule_key}
            className="rounded-lg border border-slate-200 p-3 text-sm"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                {entry.rule_key}
              </code>
              <RuleStatusBadge status={entry.status} locale={locale} />
              {entry.source_is_official ? null : (
                <span className="text-xs text-slate-500">
                  {locale === 'nl'
                    ? 'niet-officiële bron'
                    : 'source non officielle'}
                </span>
              )}
            </div>
            <p className="text-slate-700">
              <a
                href={entry.source_url}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2"
              >
                {entry.source_name}
              </a>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t.legalStatus.consultedOn} {formatDate(entry.verified_at, locale)}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              {entry.status === 'VERIFIED'
                ? format(t.legalStatus.verifiedHelp, {
                    date: formatDate(entry.verified_at, locale),
                  })
                : entry.status === 'STALE'
                  ? format(t.legalStatus.staleHelp, {
                      date: formatDate(entry.verified_at, locale),
                    })
                  : t.legalStatus.unverifiedHelp}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Waarschuwing bovenaan een resultaat dat op niet-geverifieerde regels steunt.
 * Wordt getoond zodra `needsVerification` waar is.
 */
export function NeedsVerificationNotice({ locale }: { locale: Locale }) {
  return (
    <Alert
      tone="warning"
      title={
        locale === 'nl'
          ? 'Dit resultaat moet nog geverifieerd worden'
          : 'Ce résultat doit encore être vérifié'
      }
    >
      <p>
        {locale === 'nl'
          ? 'Deze berekening steunt op minstens één regel die wij niet in een ' +
            'officiële bron hebben kunnen terugvinden, of waarover de bronnen ' +
            'elkaar tegenspreken. Gebruik de uitkomst als aanwijzing, niet als ' +
            'zekerheid.'
          : 'Ce calcul repose sur au moins une règle que nous n’avons pas pu ' +
            'retrouver dans une source officielle, ou au sujet de laquelle les ' +
            'sources se contredisent. Utilisez le résultat comme indication, ' +
            'pas comme certitude.'}
      </p>
    </Alert>
  );
}

/**
 * Legt uit wat de hash en het tijdstempel wél en niet aantonen.
 * Verschijnt in de UI én op een aparte pagina in elk PDF-rapport.
 */
export function EvidenceExplainer({ locale }: { locale: Locale }) {
  const t = getMessages(locale);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900">
        {t.evidence.title}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-2 text-sm font-semibold text-emerald-900">
            {t.evidence.proves}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-900">
            {t.evidence.explainer.proves.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">
            {t.evidence.doesNotProve}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {t.evidence.explainer.doesNotProve.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** De drie niveaus van bewijskracht, met het huidige niveau gemarkeerd. */
export function EvidenceLevelNotice({
  locale,
  level,
}: {
  locale: Locale;
  level: 'UNILATERAL_REPORT' | 'COUNTERSIGNED_REPORT';
}) {
  const t = getMessages(locale);
  const current = t.evidence.levels[level];

  return (
    <Alert tone={level === 'COUNTERSIGNED_REPORT' ? 'success' : 'info'}>
      <p className="font-semibold">{current.title}</p>
      <p>{current.description}</p>
    </Alert>
  );
}
