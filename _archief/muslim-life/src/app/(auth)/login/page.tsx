import { Suspense } from 'react'
import type { Metadata } from 'next'

import { AuthForm } from '@/modules/auth/auth-form'
import { Skeleton } from '@/components/ui/misc'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <div className="animate-rise">
      <div className="mb-7 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          {t('auth.loginTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.loginSubtitle')}</p>
      </div>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  )
}
