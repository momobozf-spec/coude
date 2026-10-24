'use client';

/**
 * Laad-, fout- en dekkingsstatussen die op elke pagina terugkomen.
 */
import type { Coverage } from '@superette/contracts';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Notice, Skeleton } from './ui';

export function errorMessage(error: unknown, t: ReturnType<typeof useI18n>['t']): string {
  if (error instanceof ApiError) {
    if (error.isNetwork) return typeof navigator !== 'undefined' && !navigator.onLine ? t('common.offline') : t('common.error.network');
    if (error.status === 401) return t('common.error.sessionExpired');
    return error.message || t('common.error.generic');
  }
  return t('common.error.generic');
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <Notice tone="danger" role="alert">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{errorMessage(error, t)}</span>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
      </div>
    </Notice>
  );
}

/** "Prijzen van 5 van de 7 geselecteerde supermarkten zijn gecontroleerd." */
export function CoverageNotice({ coverage }: { coverage: Coverage }) {
  const { t } = useI18n();
  if (coverage.chainsRequested === 0) return null;

  const summary = t('coverage.summary', { with: coverage.chainsWithData, total: coverage.chainsRequested });
  if (coverage.chainsWithData === 0) {
    return (
      <Notice tone="warning">
        {t('coverage.none')} {summary}
      </Notice>
    );
  }
  if (coverage.chainsWithData < coverage.chainsRequested) {
    return (
      <Notice tone="warning">
        {t('coverage.partial')} {summary}
      </Notice>
    );
  }
  return <p className="text-xs text-ink-muted">{summary}</p>;
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-hairline bg-canvas-raised p-4" aria-hidden="true">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-4 flex items-end justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="mt-3 h-3 w-full" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
