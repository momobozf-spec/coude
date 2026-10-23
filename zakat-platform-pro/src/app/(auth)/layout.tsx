import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getActor } from '@/server/auth/actor'
import { siteConfig } from '@/config/site'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Someone already signed in has no business on the sign-in screen.
  const actor = await getActor()
  if (actor) redirect('/dashboard')

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        {siteConfig.name}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
