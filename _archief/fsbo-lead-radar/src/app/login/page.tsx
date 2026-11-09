import { redirect } from 'next/navigation'

import { Button, Field, inputClass } from '@/components/ui'
import { createSession, isOpenAccessMode, setSessionCookie } from '@/lib/auth'
import { writeAudit } from '@/services/auditService'

export const dynamic = 'force-dynamic'

async function login(formData: FormData): Promise<void> {
  'use server'

  const password = formData.get('password')
  const next = formData.get('next')
  const target = typeof next === 'string' && next.startsWith('/admin') ? next : '/admin'

  if (typeof password !== 'string') redirect('/login?error=1')

  const token = createSession(password)
  if (!token) {
    // Bewust dezelfde melding voor "fout wachtwoord" en "geen wachtwoord
    // ingesteld": het verschil zou verraden hoe de dienst geconfigureerd is.
    await writeAudit({ actor: 'anoniem', action: 'ADMIN_LOGIN_FAILED' })
    redirect('/login?error=1')
  }

  await setSessionCookie(token)
  await writeAudit({ actor: 'admin', action: 'ADMIN_LOGIN' })
  redirect(target)
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (isOpenAccessMode()) redirect('/admin')

  const params = await searchParams
  const failed = params.error !== undefined
  const next = typeof params.next === 'string' ? params.next : '/admin'

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-6">
        <h1 className="text-base font-semibold">FSBO Lead Radar</h1>
        <p className="mt-1 mb-5 text-xs text-[var(--color-ink-soft)]">
          Meld je aan om het beheerpaneel te openen.
        </p>

        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Wachtwoord">
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              autoFocus
              className={inputClass}
            />
          </Field>

          {failed && (
            <p className="text-xs text-[var(--color-danger)]">
              Aanmelden mislukt. Controleer het wachtwoord.
            </p>
          )}

          <Button type="submit" className="w-full">
            Aanmelden
          </Button>
        </form>
      </div>
    </main>
  )
}
