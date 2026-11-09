'use client';

/**
 * "Jouw gegevens" op de profielpagina: export en accountverwijdering.
 *
 * Verwijderen vraagt drie dingen: lezen wat er gebeurt, het wachtwoord
 * opnieuw invoeren, en de bevestigingszin exact typen. Daarna is de sessie
 * weg op alle apparaten.
 */
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DELETE_ACCOUNT_CONFIRMATION } from '@superette/contracts';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { errorMessage } from './states';
import { Button, Card, Dialog, Field, Notice } from './ui';

export function AccountSection() {
  const { t } = useI18n();
  const router = useRouter();
  const { forget } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function download() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.exportAccount();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `superette-gegevens-${data.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(errorMessage(cause, t));
    } finally {
      setExporting(false);
    }
  }

  async function remove(event: FormEvent) {
    event.preventDefault();
    if (phrase.trim() !== DELETE_ACCOUNT_CONFIRMATION) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount({ password, confirmation: DELETE_ACCOUNT_CONFIRMATION });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.code === 'REAUTH_FAILED' ? t('account.delete.wrongPassword') : errorMessage(cause, t));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (done) {
      forget();
      router.push('/');
      return;
    }
    setOpen(false);
    setPassword('');
    setPhrase('');
    setError(null);
  }

  return (
    <Card as="section" aria-labelledby="account-data-title">
      <h2 id="account-data-title" className="text-base font-bold text-ink">
        {t('account.title')}
      </h2>

      <div className="mt-3 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t('account.export.title')}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t('account.export.text')}</p>
          {exportError && <Notice tone="danger" className="mt-2">{exportError}</Notice>}
          <Button variant="secondary" className="mt-2" onClick={() => void download()} disabled={exporting}>
            {exporting ? t('common.loading') : t('account.export.button')}
          </Button>
        </div>

        <div className="border-t border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink">{t('account.delete.title')}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t('account.delete.text')}</p>
          <Button variant="danger" className="mt-2" onClick={() => setOpen(true)}>
            {t('account.delete.button')}
          </Button>
        </div>
      </div>

      <Dialog open={open} onClose={close} title={t('account.delete.title')} closeLabel={t('common.close')}>
        {done ? (
          <div className="space-y-4">
            <Notice tone="success">{t('account.delete.done')}</Notice>
            <Button full onClick={close}>
              {t('account.delete.home')}
            </Button>
          </div>
        ) : (
          <form onSubmit={remove} className="space-y-4" noValidate>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-ink">{t('account.delete.removedTitle')}</p>
                <p className="text-ink-muted">{t('account.delete.removed')}</p>
              </div>
              <div>
                <p className="font-semibold text-ink">{t('account.delete.keptTitle')}</p>
                <p className="text-ink-muted">{t('account.delete.kept')}</p>
              </div>
            </div>
            {error && <Notice tone="danger">{error}</Notice>}
            <Field label={t('account.delete.password')} name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Field
              label={t('account.delete.phrase', { phrase: DELETE_ACCOUNT_CONFIRMATION })}
              name="confirmation"
              autoComplete="off"
              required
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" disabled={busy || password.length === 0 || phrase.trim() !== DELETE_ACCOUNT_CONFIRMATION}>
                {busy ? t('common.loading') : t('account.delete.confirm')}
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </Card>
  );
}
