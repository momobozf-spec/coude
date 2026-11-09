import Link from 'next/link'

import { Logo } from '@/components/layout/logo'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo href="/" />
      <p className="mt-10 font-display text-6xl font-semibold tracking-[-0.03em] text-muted-foreground/40">
        404
      </p>
      <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em]">
        {t('errors.notFound')}
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t('errors.notFoundBody')}
      </p>
      <Button className="mt-8" asChild>
        <Link href="/">{t('errors.backHome')}</Link>
      </Button>
    </div>
  )
}
