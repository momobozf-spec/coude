import Link from 'next/link'
import {
  ArrowRight,
  CalendarClock,
  FileSearch,
  MapPin,
  Scale,
  Search,
} from 'lucide-react'

import { ButtonLink } from '@/components/ui/Button'
import { APP_NAME, GENERAL_DISCLAIMER } from '@/config/public'

export default function HomePage() {
  return (
    <main id="main">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 pb-12 pt-16 md:pt-24">
        <p className="mb-4 inline-flex rounded-full bg-[var(--color-olive-100)] px-3 py-1 text-xs font-medium text-[var(--color-olive-700)]">
          Voor kopers in België
        </p>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          Vind je huis.
          <br />
          Regel je financiering.
          <br />
          <span className="text-[var(--accent)]">Weet je volgende stap.</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
          {APP_NAME} begeleidt je van je eerste zoekopdracht tot de sleutel van je nieuwe woning.
          Zoeken, financiering vergelijken, documenten verzamelen, de notaris voorbereiden en
          verhuizen — op één plek, in gewone taal.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/register" size="lg">
            Start mijn woningzoektocht
            <ArrowRight size={18} aria-hidden />
          </ButtonLink>
          <ButtonLink href="#hoe-het-werkt" variant="secondary" size="lg">
            Bekijk hoe het werkt
          </ButtonLink>
        </div>
      </section>

      {/* ── Wat het doet ─────────────────────────────────────────────────── */}
      <section id="hoe-het-werkt" className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-2xl font-semibold tracking-tight">Wat je met {APP_NAME} doet</h2>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<Search size={20} aria-hidden />}
            title="Zoek slimmer"
            body="Beschrijf in gewone taal wat je zoekt — “rond Leuven onder €500.000, minstens 3 slaapkamers, dichtbij een moskee”. Wij zetten het om in criteria en houden het voor je bij."
          />
          <Feature
            icon={<Scale size={20} aria-hidden />}
            title="Vergelijk financiering"
            body="Zie per aanbieder hoe de constructie werkt, wie ze eventueel certificeert en wat de bron is. Wij rekenen je maandlast exact door — en beweren nooit zelf dat iets toegestaan is."
          />
          <Feature
            icon={<FileSearch size={20} aria-hidden />}
            title="Begrijp ieder document"
            body="Compromis, opschortende voorwaarde, bodemattest, kadastraal inkomen. Elk begrip uitgelegd in één zin, met bron en datum."
          />
          <Feature
            icon={<CalendarClock size={20} aria-hidden />}
            title="Mis geen deadline"
            body="Je ziet altijd waar je staat, welke documenten ontbreken en wat er deze week moet gebeuren. Voor de notaris, niet erna."
          />
          <Feature
            icon={<MapPin size={20} aria-hidden />}
            title="Ontdek je toekomstige buurt"
            body="Moskeeën, scholen, halal winkels en openbaar vervoer rond elke woning — met een buurtscore die jouw voorkeuren volgt, niet die van een gemiddelde."
          />
          <Feature
            icon={<ArrowRight size={20} aria-hidden />}
            title="Eén traject, elf fasen"
            body="Van oriëntatie tot verhuizen. Elke fase met haar eigen taken, documenten en checklists — en taken die pas opengaan wanneer ze kunnen."
          />
        </div>
      </section>

      {/* ── Transparantie ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 py-12">
        <div className="rounded-2xl border bg-[var(--surface)] p-6">
          <h2 className="text-xl font-semibold tracking-tight">
            Over halal financiering zijn we eerlijk
          </h2>
          <p className="mt-3 leading-relaxed text-[var(--muted)]">
            {APP_NAME} spreekt zelf geen religieus oordeel uit. Wij tonen wie een product
            aanbiedt, hoe de constructie werkt, welk shariah-orgaan er eventueel bij betrokken is,
            wat de bron is en wanneer we die voor het laatst hebben nagekeken. Zo kan je zelf
            oordelen, eventueel met een geleerde die je vertrouwt.
          </p>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-5 pb-16">
        <p className="text-xs leading-relaxed text-[var(--muted)]">{GENERAL_DISCLAIMER}</p>
        <p className="mt-4 text-xs text-[var(--muted)]">
          <Link href="/login" className="underline underline-offset-4">
            Al een account? Log in
          </Link>
        </p>
      </footer>
    </main>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <article className="rounded-2xl border bg-[var(--surface)] p-5">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-olive-100)] text-[var(--color-olive-700)]">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{body}</p>
    </article>
  )
}
