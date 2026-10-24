'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AppShell } from '@/components/app-shell';
import { ErrorState, errorMessage, ListSkeleton } from '@/components/states';
import { Button, Card, EmptyState, Field, Notice, PageTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { formatRelative } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useAsync } from '@/lib/use-async';

export default function ListsPage() {
  const { t, locale } = useI18n();
  const { user, loading } = useRequireAuth('/lijsten');
  const router = useRouter();
  const lists = useAsync(() => api.lists(), [user?.id], !!user);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const list = await api.createList({ name: trimmed });
      router.push(`/lijsten/${list.id}`);
    } catch (cause) {
      setError(errorMessage(cause, t));
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <AppShell>
        <ListSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle>{t('lists.title')}</PageTitle>

      <form onSubmit={create} className="mb-6 flex items-end gap-2">
        <Field label={t('lists.create')} name="name" placeholder={t('lists.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} className="flex-1" maxLength={80} />
        <Button type="submit" disabled={busy || name.trim().length === 0}>
          {t('common.add')}
        </Button>
      </form>
      {error && <Notice tone="danger" className="mb-4">{error}</Notice>}

      {lists.loading && !lists.data && <ListSkeleton rows={2} />}
      {lists.error ? <ErrorState error={lists.error} onRetry={lists.reload} /> : null}
      {lists.data && lists.data.length === 0 && <EmptyState title={t('lists.empty.title')} text={t('lists.empty.text')} />}
      {lists.data && lists.data.length > 0 && (
        <ul className="space-y-3">
          {lists.data.map((list) => (
            <Card key={list.id} as="li" className={list.archived ? 'opacity-70' : ''}>
              <Link href={`/lijsten/${list.id}`} className="block rounded-lg">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-ink">{list.name}</span>
                  <span className="text-xs text-ink-muted">{formatRelative(list.updatedAt, locale)}</span>
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {list.itemCount === 1 ? t('lists.item') : t('lists.items', { n: list.itemCount })}
                  {list.itemCount > 0 && ` · ${t('lists.checked', { checked: list.checkedCount, total: list.itemCount })}`}
                  {list.archived && ` · ${t('lists.archived')}`}
                </span>
              </Link>
            </Card>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
