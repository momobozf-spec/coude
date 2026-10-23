import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/modules/auth/password-forms'
import { emailConfigured } from '@/server/integrations/email'
import { legalEntity } from '@/config/legal'
import { t } from '@/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <div className="animate-rise">
      <div className="mb-7 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
          {t('auth.forgotTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.forgotSubtitle')}</p>
      </div>
      <ForgotPasswordForm emailEnabled={emailConfigured()} supportEmail={legalEntity().email} />
    </div>
  )
}
