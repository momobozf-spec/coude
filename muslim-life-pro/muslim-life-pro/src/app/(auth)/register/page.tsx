import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Lock } from 'lucide-react'

import { AuthForm } from '@/modules/auth/auth-form'
import { Skeleton } from '@/components/ui/misc'
import { t } from '@/i18n'

export const metadata: Metadata = {
  title: 'Create account',
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <div className="animate-rise">
      <div className="mb-7 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          {t('auth.registerTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.registerSubtitle')}</p>
      </div>

      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <AuthForm mode="register" />
      </Suspense>

      <p className="mt-6 flex items-start gap-2 rounded-lg bg-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <Lock className="mt-px size-3.5 shrink-0" />
        {t('auth.privacyNote')}
      </p>
    </div>
  )
}
