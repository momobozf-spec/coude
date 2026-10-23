import type { Metadata } from 'next'
import Link from 'next/link'

import { ResetPasswordForm } from '@/modules/auth/password-forms'
import { t } from '@/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
  // The token is in the URL: never leak it to another site via Referer.
  referrer: 'no-referrer',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="animate-rise">
      <div className="mb-7 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          {t('auth.resetTitle')}
        </h1>
      </div>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          {t('auth.resetInvalid')}{' '}
          <Link href="/forgot-password" className="text-primary hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </p>
      )}
    </div>
  )
}
