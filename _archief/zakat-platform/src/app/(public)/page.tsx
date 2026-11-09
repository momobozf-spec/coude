import { Calculator, FileBarChart, HandCoins, Heart, ShieldCheck, Users } from 'lucide-react'

import { ButtonLink, Card, CardContent } from '@/components/ui'
import { RELIGIOUS_DISCLAIMER } from '@/config/site'

const SECTIONS = [
  {
    icon: Calculator,
    title: 'Bereken correct en transparant',
    body: 'Je ziet elke stap: welk vermogen meetelt, welke schulden aftrekbaar zijn, welke nisab is gebruikt en waarom.',
  },
  {
    icon: FileBarChart,
    title: 'Bewaar je jaarlijkse historie',
    body: 'Elke afgeronde berekening wordt bevroren, inclusief de goudprijs en wisselkoersen van dat moment. Oude jaren veranderen nooit meer.',
  },
  {
    icon: HandCoins,
    title: 'Volg Zakat en Sadaqah',
    body: 'Registreer wat je betaalt en aan wie. Zie in één oogopslag hoeveel van je Zakat nog openstaat.',
  },
  {
    icon: Heart,
    title: 'Ontdek betrouwbare goede doelen',
    body: 'Met bronvermelding per claim en een transparantiescore waarvan je precies ziet hoe die is opgebouwd.',
  },
  {
    icon: Users,
    title: 'Beheer alles als gezin',
    body: 'Een gedeeld huishoudoverzicht, terwijl ieders bezit van zichzelf blijft.',
  },
]

export default function HomePage() {
  return (
    <>
      <section className="pattern-geometric border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Bereken je Zakat.
              <br />
              Beheer je Sadaqah.
              <br />
              <span className="text-primary">Geef met meer inzicht.</span>
            </h1>

            <p className="mt-5 text-lg text-muted text-pretty">
              Alles rond Zakat en liefdadigheid op één plek — met een berekening die je
              volledig kunt navertellen.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/register" size="lg">
                Bereken mijn Zakat
              </ButtonLink>
              <ButtonLink href="/charities" variant="secondary" size="lg">
                Ontdek goede doelen
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <Icon className="size-5 text-primary" aria-hidden />
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-muted">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <Card className="bg-surface-muted/50">
          <CardContent className="flex gap-3 pt-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="font-semibold">Geen black box, geen fatwa</h2>
              <p className="mt-1 text-sm text-muted">{RELIGIOUS_DISCLAIMER}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
