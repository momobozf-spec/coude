import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { LoginForm } from '@/modules/auth/login-form'

export const metadata: Metadata = { title: 'Inloggen' }

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inloggen</CardTitle>
        <CardDescription>Welkom terug.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <LoginForm />
        <p className="text-sm text-muted">
          Nog geen account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Aanmelden
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
