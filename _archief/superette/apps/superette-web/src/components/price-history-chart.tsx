'use client';

/**
 * Prijslijn per keten over de laatste periode.
 *
 * Volgens de dataviz-regels: één as, 2px-lijnen met ronde joins, markers
 * van 8px met een ring in de ondergrondkleur, een kruisdraad met één tooltip
 * voor alle reeksen, een legenda zodra er twee of meer reeksen zijn, kleur die
 * de keten volgt (nooit de rangorde), en altijd een tabelweergave. Tekst
 * draagt tekstkleuren, nooit de reekskleur.
 */
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { PriceHistorySummary } from '@superette/contracts';
import { chainColorVar } from '@/lib/chains';
import { formatDate, formatEuro } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { Notice } from './ui';

interface Series {
  slug: string;
  name: string;
  points: Array<{ t: number; cents: number; promotion: string }>;
}

const WIDTH = 640;
const HEIGHT = 260;
const MARGIN = { top: 16, right: 24, bottom: 36, left: 56 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min];
  const span = max - min;
  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const steps = [1, 2, 2.5, 5, 10].map((s) => s * magnitude);
  const step = steps.find((s) => s >= rough) ?? magnitude * 10;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

export function PriceHistoryChart({ history, chainNames }: { history: PriceHistorySummary; chainNames: Record<string, string> }) {
  const { t, locale } = useI18n();
  const titleId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo<Series[]>(() => {
    const bySlug = new Map<string, Series>();
    for (const point of history.points) {
      const entry = bySlug.get(point.storeChainSlug) ?? { slug: point.storeChainSlug, name: chainNames[point.storeChainSlug] ?? point.storeChainSlug, points: [] };
      entry.points.push({ t: new Date(point.observedAt).getTime(), cents: point.priceCents, promotion: point.promotionType });
      bySlug.set(point.storeChainSlug, entry);
    }
    for (const entry of bySlug.values()) entry.points.sort((a, b) => a.t - b.t);
    return [...bySlug.values()];
  }, [history.points, chainNames]);

  const timestamps = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b), [series]);

  if (!history.sufficient || series.length === 0 || timestamps.length === 0) {
    return (
      <div className="space-y-3">
        <Notice tone="info">{t('product.history.insufficient')}</Notice>
        {history.points.length > 0 && <HistoryTable history={history} chainNames={chainNames} />}
        <p className="text-xs text-ink-muted">{history.disclaimer}</p>
      </div>
    );
  }

  const allCents = series.flatMap((s) => s.points.map((p) => p.cents));
  const minCents = Math.min(...allCents);
  const maxCents = Math.max(...allCents);
  const yTicks = niceTicks(Math.max(0, minCents - (maxCents - minCents) * 0.15 - 10), maxCents + (maxCents - minCents) * 0.15 + 10);
  const yMin = yTicks[0]!;
  const yMax = yTicks.at(-1)!;
  const tMin = timestamps[0]!;
  const tMax = timestamps.at(-1)!;
  const tSpan = Math.max(1, tMax - tMin);

  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (time: number) => MARGIN.left + ((time - tMin) / tSpan) * plotW;
  const y = (cents: number) => MARGIN.top + plotH - ((cents - yMin) / Math.max(1, yMax - yMin)) * plotH;

  const xTickTimes = timestamps.length <= 4 ? timestamps : [0, 1, 2, 3].map((i) => tMin + (tSpan * i) / 3);

  const hoveredTime: number | null = hover !== null ? (timestamps[hover] ?? null) : null;
  const tooltipRows =
    hoveredTime === null
      ? []
      : series
          .map((s) => {
            // Laatst bekende prijs op of vóór het aangewezen moment.
            const point = [...s.points].reverse().find((p) => p.t <= hoveredTime) ?? null;
            return point ? { slug: s.slug, name: s.name, cents: point.cents, promotion: point.promotion } : null;
          })
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .sort((a, b) => a.cents - b.cents);

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const time = tMin + ratio * tSpan;
    let best = 0;
    for (let i = 1; i < timestamps.length; i++) {
      if (Math.abs(timestamps[i]! - time) < Math.abs(timestamps[best]! - time)) best = i;
    }
    setHover(best);
  }

  function onKeyDown(event: KeyboardEvent<SVGRectElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setHover((h) => Math.min(timestamps.length - 1, (h ?? -1) + 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setHover((h) => Math.max(0, (h ?? timestamps.length) - 1));
    } else if (event.key === 'Escape') {
      setHover(null);
    }
  }

  const announcement =
    hoveredTime !== null
      ? `${formatDate(hoveredTime, locale, 'dateTime')}: ${tooltipRows.map((row) => `${row.name} ${formatEuro(row.cents, locale)}`).join(', ')}`
      : '';

  const endLabels = series.length <= 4;

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={titleId} className="h-auto w-full">
          <title id={titleId}>
            {t('product.history')} · {t('product.history.period', { days: history.periodDays })}
          </title>

          {/* Promotieperiodes: zachte band op de achtergrond. */}
          {history.promotionPeriods.map((period, index) => {
            const from = x(new Date(period.from).getTime());
            const to = x(new Date(period.to).getTime());
            return <rect key={index} x={Math.min(from, to) - 3} y={MARGIN.top} width={Math.max(6, Math.abs(to - from))} height={plotH} fill="var(--brand-soft)" opacity={0.6} />;
          })}

          {/* Rasterlijnen en y-as: hairline, recessief. */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="var(--hairline)" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="var(--ink-muted)">
                {formatEuro(tick, locale)}
              </text>
            </g>
          ))}

          {/* x-as */}
          {xTickTimes.map((time, i) => (
            <text key={i} x={x(time)} y={HEIGHT - 10} textAnchor={i === 0 ? 'start' : i === xTickTimes.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--ink-muted)">
              {formatDate(time, locale, 'dayMonth')}
            </text>
          ))}

          {/* Kruisdraad */}
          {hoveredTime !== null && <line x1={x(hoveredTime)} x2={x(hoveredTime)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--ink-muted)" strokeWidth={1} />}

          {/* Reeksen */}
          {series.map((s) => {
            const color = chainColorVar(s.slug);
            const path = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)} ${y(p.cents).toFixed(1)}`).join(' ');
            const last = s.points.at(-1)!;
            return (
              <g key={s.slug}>
                <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.points.map((p, i) => (
                  <circle key={i} cx={x(p.t)} cy={y(p.cents)} r={4} fill={color} stroke="var(--canvas-raised)" strokeWidth={2} />
                ))}
                {endLabels && (
                  <text x={x(last.t) + 8} y={y(last.cents) + 4} fontSize={11} fontWeight={600} fill="var(--ink)">
                    {formatEuro(last.cents, locale)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover- en toetsenbordlaag, groter dan de markers. */}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={t('product.history.chart')}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setHover(null)}
          />
        </svg>

        {hoveredTime !== null && tooltipRows.length > 0 && (
          <div
            className="pointer-events-none absolute top-2 rounded-xl border border-hairline bg-canvas-raised px-3 py-2 text-xs shadow-[var(--shadow)]"
            style={{ left: `${Math.min(70, Math.max(0, ((x(hoveredTime) - MARGIN.left) / plotW) * 100))}%` }}
          >
            <p className="mb-1 font-semibold text-ink">{formatDate(hoveredTime, locale, 'dateTime')}</p>
            <ul className="space-y-0.5">
              {tooltipRows.map((row) => (
                <li key={row.slug} className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: chainColorVar(row.slug) }} />
                  <span className="font-semibold tabular-nums text-ink">{formatEuro(row.cents, locale)}</span>
                  <span className="text-ink-muted">{row.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>

      {series.length >= 2 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink">
          {series.map((s) => (
            <li key={s.slug} className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-5 rounded" style={{ backgroundColor: chainColorVar(s.slug) }} />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-xl border border-hairline">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink">{t('product.history.table')}</summary>
        <div className="px-3 pb-3">
          <HistoryTable history={history} chainNames={chainNames} />
        </div>
      </details>

      <p className="text-xs text-ink-muted">{history.disclaimer}</p>
    </div>
  );
}

function HistoryTable({ history, chainNames }: { history: PriceHistorySummary; chainNames: Record<string, string> }) {
  const { t, locale } = useI18n();
  const rows = [...history.points].sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, 60);
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">{t('product.history')}</caption>
      <thead>
        <tr className="text-left text-ink-muted">
          <th scope="col" className="py-1 font-normal">
            {t('provenance.lastChecked')}
          </th>
          <th scope="col" className="py-1 font-normal">
            {t('alerts.filter.chain')}
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {t('search.packagePrice')}
          </th>
          <th scope="col" className="py-1 font-normal">
            {t('promo.label')}
          </th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((point, i) => (
          <tr key={i} className="border-t border-hairline">
            <td className="py-1">
              <time dateTime={point.observedAt}>{formatDate(point.observedAt, locale, 'dateTime')}</time>
            </td>
            <td className="py-1">{chainNames[point.storeChainSlug] ?? point.storeChainSlug}</td>
            <td className="py-1 text-right font-semibold">{formatEuro(point.priceCents, locale)}</td>
            <td className="py-1 text-ink-muted">{point.promotionType === 'NONE' ? '—' : point.promotionType.toLowerCase().replace(/_/g, ' ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** De vijf kerngetallen boven de grafiek. */
export function HistoryStats({ history }: { history: PriceHistorySummary }) {
  const { t, locale } = useI18n();
  const tiles: Array<{ label: string; value: number | null }> = [
    { label: t('product.history.current'), value: history.currentCents },
    { label: t('product.history.previous'), value: history.previousCents },
    { label: t('product.history.lowest'), value: history.lowestCents },
    { label: t('product.history.highest'), value: history.highestCents },
    { label: t('product.history.average'), value: history.averageCents },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-hairline bg-canvas-raised px-3 py-2">
          <dt className="text-[11px] text-ink-muted">{tile.label}</dt>
          <dd className="text-base font-semibold tabular-nums text-ink">{tile.value === null ? '—' : formatEuro(tile.value, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}
