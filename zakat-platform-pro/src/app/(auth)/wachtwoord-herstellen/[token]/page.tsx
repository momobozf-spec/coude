import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { ResetConfirmForm } from '@/modules/auth/account-forms'
import { isResetTokenValid } from '@/server/modules/account/service'

export const metadata: Metadata = { title: 'Nieuw wachtwoord', referrer: 'no-referrer' }

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const valid = token.length >= 20 && token.length <= 200 && (await isResetTokenValid(token))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nieuw wachtwoord</CardTitle>
        {valid ? <CardDescription>Kies een nieuw wachtwoord voor je account.</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {valid ? (
          <ResetConfirmForm token={token} />
        ) : (
          <p className="text-sm">
            Deze link is verlopen of al gebruikt.{' '}
            <Link href="/wachtwoord-vergeten" className="font-medium text-primary hover:underline">
              Vraag een nieuwe aan
            </Link>
            .
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export const dynamic = 'force-dynamic'
