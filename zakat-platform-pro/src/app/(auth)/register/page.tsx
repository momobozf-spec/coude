import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { RegisterForm } from '@/modules/auth/register-form'

export const metadata: Metadata = { title: 'Aanmelden' }

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account aanmaken</CardTitle>
        <CardDescription>
          Je financiële gegevens zijn standaard privé en worden nooit gedeeld.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RegisterForm />
        <p className="text-sm text-muted">
          Heb je al een account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inloggen
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
