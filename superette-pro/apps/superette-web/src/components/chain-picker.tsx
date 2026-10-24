'use client';

import type { StoreChain, StoreChainRef } from '@superette/contracts';
import { useI18n } from '@/lib/i18n';
import { ChainBadge } from './price';

/** Selectie van ketens als groep checkboxes. Werkt met toetsenbord en schermlezer. */
export function ChainPicker({
  legend,
  hint,
  chains,
  selected,
  onChange,
  name,
}: {
  legend: string;
  hint?: string;
  chains: ReadonlyArray<StoreChain | StoreChainRef>;
  selected: readonly string[];
  onChange: (slugs: string[]) => void;
  name: string;
}) {
  const { t } = useI18n();
  const toggle = (slug: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(slug);
    else next.delete(slug);
    onChange([...next]);
  };

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mb-2 text-xs text-ink-muted">{hint}</p>}
      <div className="grid gap-1 sm:grid-cols-2">
        {chains.map((chain) => {
          const checked = selected.includes(chain.slug);
          const noData = 'dataSourceKind' in chain && chain.dataSourceKind === null;
          return (
            <label key={chain.slug} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-canvas-sunken">
              <input
                type="checkbox"
                name={name}
                value={chain.slug}
                checked={checked}
                onChange={(event) => toggle(chain.slug, event.target.checked)}
                className="size-5 shrink-0 rounded accent-[var(--brand)]"
              />
              <ChainBadge chain={chain} size="sm" />
              {noData && <span className="text-[11px] text-ink-muted">({t('chain.noData')})</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
