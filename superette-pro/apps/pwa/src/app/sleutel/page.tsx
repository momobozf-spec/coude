'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { QrKey } from '@/components/qr-key';
import { Button, Card } from '@/components/ui';
import { api, type PublicStore } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function KeyPage() {
  const { loading } = useRequireAuth();
  const { storeId, setStoreId, logout } = useAuth();
  const { t } = useI18n();

  const [stores, setStores] = useState<PublicStore[] | null>(null);

  useEffect(() => {
    api.stores().then(setStores).catch(() => setStores([]));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      </AppShell>
    );
  }

  // Geen winkel gekozen: eerst kiezen. Een sleutel voor "een winkel" bestaat
  // niet — elke QR is gebonden aan één deur.
  if (!storeId) {
    return (
      <AppShell title={t('store.choose')}>
        <StorePicker stores={stores} onPick={setStoreId} />
      </AppShell>
    );
  }

  return (
    <AppShell title={t('key.title')}>
      <div className="flex flex-col items-center gap-8">
        <QrKey storeId={storeId} />

        <div className="w-full space-y-3">
          {/* Alleen zichtbaar in ontwikkeling: er hangt hier geen echte scanner. */}
          {process.env['NEXT_PUBLIC_ENABLE_DEV_SCANNER'] === 'true' && (
            <a
              href="/simulator/deur"
              className="block rounded-xl border border-accent/40 bg-accent/10 px-5 py-3.5 text-center text-sm font-medium text-accent"
            >
              Open de deurscanner (dev)
            </a>
          )}

          <Button variant="ghost" onClick={() => setStoreId('')}>
            {t('store.choose')}
          </Button>
          <Button variant="ghost" onClick={logout}>
            {t('auth.logout')}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function StorePicker({ stores, onPick }: { stores: PublicStore[] | null; onPick: (id: string) => void }) {
  const { t } = useI18n();

  if (!stores) return <p className="text-sm text-ink-muted">{t('common.loading')}</p>;

  return (
    <ul className="space-y-3">
      {stores.map((store) => (
        <li key={store.id}>
          <button
            type="button"
            onClick={() => onPick(store.id)}
            className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            <Card className="flex items-center justify-between gap-4 transition-colors hover:border-accent/50">
              <span>
                <span className="block font-medium">{store.name}</span>
                <span className="block text-xs text-ink-muted">
                  {store.address}, {store.city}
                </span>
              </span>

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
                  store.hasCapacity ? 'border-success/40 text-success' : 'border-danger/40 text-danger'
                }`}
              >
                {store.hasCapacity ? t('store.open') : t('store.full')}
              </span>
            </Card>
          </button>
        </li>
      ))}
    </ul>
  );
}
