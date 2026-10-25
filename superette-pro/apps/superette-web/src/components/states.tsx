'use client';

/**
 * Laad-, fout- en dekkingsstatussen die op elke pagina terugkomen.
 */
import type { Coverage } from '@superette/contracts';
import { ApiError } from '@/lib/api';
import { errorKind, type ErrorKind } from '@/lib/error-kind';
import { useI18n } from '@/lib/i18n';
import { Button, Notice, Skeleton } from './ui';

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function errorMessage(error: unknown, t: ReturnType<typeof useI18n>['t']): string {
  const kind = errorKind(error, isOnline());
  if (kind === 'offline') return t('common.offline');
  if (kind === 'network') return t('common.error.network');
  if (kind === 'session') return t('common.error.sessionExpired');
  if (error instanceof ApiError) return error.message || t('common.error.generic');
  return t('common.error.generic');
}

const TITLE_KEY = {
  offline: 'common.offlineTitle',
  network: 'common.error.networkTitle',
  session: 'common.error.sessionTitle',
  generic: 'common.error.genericTitle',
} as const satisfies Record<ErrorKind, string>;

function ErrorIcon({ kind }: { kind: ErrorKind }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'offline' || kind === 'network' ? (
        <>
          <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
          <circle cx="12" cy="19.5" r="0.8" fill="currentColor" />
          <path d="M3 3l18 18" />
        </>
      ) : kind === 'session' ? (
        <>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4.5M12 16h.01" />
        </>
      )}
    </svg>
  );
}

/** Foutmelding als rustig blok: wat er misging, wat je kunt doen, en een knop om opnieuw te proberen. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const kind = errorKind(error, isOnline());
  return (
    <div role="alert" className="flex flex-col items-center rounded-[18px] border border-hairline bg-canvas-raised px-6 py-8 text-center shadow-[var(--shadow)]">
      <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <ErrorIcon kind={kind} />
      </div>
      <h2 className="text-lg font-bold text-ink">{t(TITLE_KEY[kind])}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{errorMessage(error, t)}</p>
      {onRetry && (
        <Button variant="primary" className="mt-5" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/** "Prijzen van 5 van de 7 geselecteerde supermarkten zijn gecontroleerd." */
export function CoverageNotice({ coverage, size = 'md' }: { coverage: Coverage; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  if (coverage.chainsRequested === 0) return null;

  const summary = t('coverage.summary', { with: coverage.chainsWithData, total: coverage.chainsRequested });
  if (coverage.chainsWithData === 0) {
    return (
      <Notice tone="warning" size={size}>
        {t('coverage.none')} {summary}
      </Notice>
    );
  }
  if (coverage.chainsWithData < coverage.chainsRequested) {
    return (
      <Notice tone="warning" size={size}>
        {t('coverage.partial')} {summary}
      </Notice>
    );
  }
  return <p className="text-xs text-ink-muted">{summary}</p>;
}

/**
 * Dekking en demoprijzen samen in één compacte melding boven resultaten.
 * Volledige dekking zonder demo: alleen de korte samenvatting.
 */
export function DataNotice({ coverage, containsDemoData }: { coverage: Coverage; containsDemoData: boolean }) {
  const { t } = useI18n();
  const partial = coverage.chainsRequested > 0 && coverage.chainsWithData < coverage.chainsRequested;
  if (!partial && !containsDemoData) return <CoverageNotice coverage={coverage} />;
  const summary = t('coverage.summary', { with: coverage.chainsWithData, total: coverage.chainsRequested });
  return (
    <Notice tone="warning" size="sm">
      {partial && (
        <span className="block">
          {coverage.chainsWithData === 0 ? t('coverage.none') : t('coverage.partial')} {summary}
        </span>
      )}
      {containsDemoData && <span className={`block ${partial ? 'mt-1 font-semibold' : 'font-semibold'}`}>{t('search.demoNotice')}</span>}
    </Notice>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[18px] border border-hairline bg-canvas-raised p-4" aria-hidden="true">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-[4.5rem] w-32 rounded-[10px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only" role="status">
        {t('common.loading')}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
