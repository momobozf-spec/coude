'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CatalogProductSummary, ShoppingListSummary } from '@superette/contracts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { errorMessage } from './states';
import { Button, ButtonLink, Dialog, Field, Notice } from './ui';

/**
 * "Voeg toe aan lijst": kies een bestaande lijst of maak er een. Zonder
 * account: uitleg en een link naar inloggen die terugbrengt naar hier.
 */
export function AddToListDialog({ product, onClose }: { product: CatalogProductSummary | null; onClose: () => void }) {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [lists, setLists] = useState<ShoppingListSummary[] | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: string; name: string } | null>(null);

  const open = product !== null;

  useEffect(() => {
    if (!open || !user) return;
    setAdded(null);
    setError(null);
    api
      .lists()
      .then((all) => setLists(all.filter((list) => !list.archived)))
      .catch((cause) => setError(errorMessage(cause, t)));
  }, [open, user, t]);

  async function addTo(listId: string, name: string) {
    if (!product) return;
    setBusy(true);
    setError(null);
    try {
      await api.addItem(listId, { catalogProductId: product.id, quantity: 1, exactBrandRequired: false, allowStoreBrand: true, allowAlternatives: true });
      setAdded({ id: listId, name });
    } catch (cause) {
      setError(errorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const list = await api.createList({ name });
      await addTo(list.id, list.name);
      setNewName('');
    } catch (cause) {
      setError(errorMessage(cause, t));
      setBusy(false);
    }
  }

  const returnTo = typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search;

  return (
    <Dialog open={open} onClose={onClose} title={t('lists.pick.title')} closeLabel={t('common.close')}>
      {product && (
        <p className="mb-4 text-sm text-ink-muted">
          {product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? `${product.brand} ` : ''}
          {product.name} · {product.packageLabel}
        </p>
      )}

      {!loading && !user && (
        <div className="space-y-3">
          <Notice tone="info">{t('common.loginRequired')}</Notice>
          <ButtonLink href={`/inloggen?terug=${encodeURIComponent(returnTo)}`} full>
            {t('common.loginToContinue')}
          </ButtonLink>
        </div>
      )}

      {user && added && (
        <div className="space-y-3">
          <Notice tone="success">{t('lists.pick.added', { name: added.name })}</Notice>
          <div className="flex gap-2">
            <ButtonLink href={`/lijsten/${added.id}`} variant="secondary" full>
              {t('lists.pick.view')}
            </ButtonLink>
            <Button variant="primary" full onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      )}

      {user && !added && (
        <div className="space-y-4">
          {error && <Notice tone="danger">{error}</Notice>}
          {lists === null && !error && <p className="text-sm text-ink-muted">{t('common.loading')}</p>}
          {lists && lists.length > 0 && (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void addTo(list.id, list.name)}
                    className="flex min-h-12 w-full items-center justify-between px-3 text-left text-sm hover:bg-canvas-sunken disabled:opacity-50"
                  >
                    <span className="font-semibold">{list.name}</span>
                    <span className="text-xs text-ink-muted">{list.itemCount === 1 ? t('lists.item') : t('lists.items', { n: list.itemCount })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createAndAdd();
            }}
            className="flex items-end gap-2"
          >
            <Field label={t('lists.pick.new')} name="newList" placeholder={t('lists.namePlaceholder')} value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" maxLength={80} />
            <Button type="submit" disabled={busy || newName.trim().length === 0}>
              {t('common.add')}
            </Button>
          </form>
          <p className="text-xs text-ink-muted">
            <Link href="/lijsten" className="underline underline-offset-2">
              {t('lists.title')}
            </Link>
          </p>
        </div>
      )}
    </Dialog>
  );
}
