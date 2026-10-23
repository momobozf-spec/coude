'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The digest is the only safe correlation handle — the message itself may
    // contain internal detail and is never shown to the user.
    console.error('[app] Unhandled error', { digest: error.digest })
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-danger-subtle">
        <AlertTriangle className="size-5 text-danger" />
      </span>

      <h1 className="mt-6 font-display text-2xl font-semibold tracking-[-0.02em]">
        {t('errors.generic')}
      </h1>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}

      <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
        <Button onClick={reset}>{t('errors.tryAgain')}</Button>
        <Button variant="secondary" asChild>
          <Link href="/">{t('errors.backHome')}</Link>
        </Button>
      </div>
    </div>
  )
}
