import { redirect } from 'next/navigation'

import { getSession, ROLE_LABELS } from '@/lib/session'
import * as agencyRepository from '@/repositories/agencyRepository'

import { Nav } from './Nav'
import { logout } from '../_actions/auth'

/**
 * De schil om alles wat achter de inlog zit.
 *
 * Hier valt de eerste en belangrijkste controle: geen sessie, geen pagina. Elke
 * onderliggende route herhaalt die controle op zijn eigen manier — met
 * `requireAgencyScope`, dat óók de kantoorgrens afdwingt — maar deze laag zorgt
 * dat een niet-ingelogde bezoeker nooit verder komt dan de loginpagina, ook niet
 * als een route dat ooit zou vergeten.
 */
export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect('/login')

  // Een platformbeheerder hoort bij geen kantoor en heeft in de kantoorschermen
  // niets te zoeken; hij wordt naar zijn eigen omgeving gestuurd.
  if (!session.agencyId) redirect('/admin/sources')

  const [agency, user] = await Promise.all([
    agencyRepository.findAgency(session.agencyId),
    agencyRepository.findUser(session.userId),
  ])

  if (!agency || !user) redirect('/login')

  return (
    <div className="min-h-screen">
      <Nav
        agencyName={agency.name}
        userName={user.name ?? user.email}
        roleLabel={ROLE_LABELS[session.role]}
        canManage={session.role !== 'AGENT'}
        logoutAction={logout}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
