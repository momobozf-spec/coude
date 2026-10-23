import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { ResetRequestForm } from '@/modules/auth/account-forms'

export const metadata: Metadata = { title: 'Wachtwoord vergeten' }

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wachtwoord vergeten</CardTitle>
        <CardDescription>We sturen je een link om een nieuw wachtwoord te kiezen.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ResetRequestForm />
        <p className="text-sm text-muted">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Terug naar inloggen
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
