import Link from "next/link";
import { db } from "@/db";
import { source } from "@/db/schema";
import { Badge, btn, Notice } from "@/components/ui";
import { createLeadAction } from "./actions";
import { formatBrussels } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Landing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sources = await db.select().from(source).catch(() => []);
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold text-navy-900">TenderKompas IT</span>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#aanbod" className="text-navy-700 hover:underline">Aanbod</a>
            <a href="#voorbeeld" className="text-navy-700 hover:underline">Voorbeeld</a>
            <a href="#bronnen" className="text-navy-700 hover:underline">Bronnen</a>
            <Link href="/login" className={btn("secondary", "sm")}>Aanmelden</Link>
          </nav>
        </div>
      </header>

      <section className="bg-navy-900 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-wider text-navy-100">Voor Belgische data- en cloudbureaus (3–30 medewerkers)</p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Welke openbare opdrachten verdienen deze week uw aandacht?</h1>
            <p className="mt-4 max-w-xl text-navy-100">
              Wij volgen openbare aanbestedingen op voor Azure en cloud, Microsoft Fabric en Power BI, Databricks en data-engineering, datawarehousing,
              analytics en datagovernance. Per kans krijgt u een gecontroleerde uitleg: waarom ze past, welke voorwaarden gelden, wat nog onbekend is en
              wat de volgende stap is.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#aanvraag" className={btn("secondary")}>Pilot aanvragen</a>
              <a href="#voorbeeld" className="inline-flex items-center px-3 text-sm text-navy-100 underline">Bekijk een voorbeeld</a>
            </div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/5 p-5 text-sm">
            <div className="font-semibold">Zo werkt het</div>
            <ol className="mt-3 space-y-2 text-navy-100">
              <li>1. U legt uw bedrijfsprofiel vast: diensten, technologie, referenties, certificeringen, capaciteit.</li>
              <li>2. Wij halen aankondigingen op uit de bronnen die we opvolgen en extraheren de voorwaarden met bronbewijs.</li>
              <li>3. Een mens controleert elke beoordeling vóór publicatie.</li>
              <li>4. U ontvangt wekelijks maximaal vijf uitgewerkte kansen — of eerlijk bericht dat er geen zijn.</li>
              <li>5. Uw feedback scherpt de selectie aan.</li>
            </ol>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-14 px-4 py-12">
        <section id="aanbod" className="grid gap-6 md:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-xl font-semibold text-navy-900">Pilotaanbod</h2>
            <p className="mt-2 text-sm text-muted">Werkhypothese tijdens de pilot — prijs en inhoud worden samen met de eerste klanten gevalideerd.</p>
            <div className="mt-4 rounded-lg border border-line bg-white p-5">
              <div className="text-3xl font-semibold text-navy-900">
                €299 <span className="text-base font-normal text-muted">excl. btw / maand</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li>• Eén bedrijfsprofiel</li>
                <li>• Maximaal vijf uitgewerkte kansen per week, enkel als er voldoende relevante kansen zijn</li>
                <li>• Tussentijdse melding bij belangrijke wijzigingen aan gevolgde opdrachten</li>
                <li>• Per kans: aansluiting, voorwaarden (voldaan / niet voldaan / onbekend), praktische haalbaarheid en bronbewijs</li>
              </ul>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <h3 className="text-base font-semibold text-navy-900">Wat we niet beloven</h3>
            <Notice tone="warn">
              Geen garantie op volledigheid van de opvolging, op toelating tot een procedure of op het winnen van opdrachten. Een relevantiescore drukt
              inhoudelijke aansluiting uit, nooit een winkans.
            </Notice>
            <p className="text-muted">
              We werken uitsluitend met openbare of rechtmatig aangeleverde informatie. Bronnen worden in hun oorspronkelijke taal bewaard; vertaalde
              samenvattingen zijn als vertaling gemarkeerd.
            </p>
          </div>
        </section>

        <section id="voorbeeld">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-xl font-semibold text-navy-900">Voorbeeld van een uitgewerkte kans</h2>
            <Badge tone="warn">Fictieve voorbeeldgegevens</Badge>
          </div>
          <div className="grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-3">
            <div className="md:col-span-2 space-y-3 text-sm">
              <div>
                <div className="text-base font-semibold text-navy-900">VOORBEELD — Opbouw van een dataplatform met rapportering</div>
                <div className="text-muted">Fictieve opdrachtgever · Vlaams Gewest · Openbare procedure</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="warn">Eerst ontbrekende informatie controleren</Badge>
                <Badge tone="neutral">Relevantiescore 78/100 — geen winkans</Badge>
              </div>
              <div>
                <span className="font-semibold">Voorwaarden:</span> referenties <Badge tone="ok">Voldaan</Badge> · ISO 27001 op bedrijfsniveau{" "}
                <Badge tone="warn">Onbekend</Badge> · minimale omzet <Badge tone="neutral">Niet van toepassing</Badge>
              </div>
              <div>
                <span className="font-semibold">Volgende stap:</span> nagaan of de certificering op bedrijfsniveau vereist is (vraag stellen vóór de vragendeadline).
              </div>
            </div>
            <div className="rounded-md bg-navy-50 p-3 text-sm">
              <div className="font-semibold text-navy-900">Bronbewijs</div>
              <p className="mt-1 text-muted">Elke deadline, waarde en voorwaarde verwijst naar het bronveld of de pagina in het document, met de laatste controledatum.</p>
            </div>
          </div>
        </section>

        <section id="bronnen">
          <h2 className="text-xl font-semibold text-navy-900">Bronnen en werkelijke dekking</h2>
          <p className="mt-1 text-sm text-muted">We volgen niet alle Belgische opdrachten. Dit is wat we vandaag wel en niet automatisch opvolgen.</p>
          <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
            <table className="tk">
              <thead>
                <tr>
                  <th>Bron</th>
                  <th>Werkwijze</th>
                  <th>Dekking</th>
                  <th>Laatste geslaagde verwerking</th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .filter((s) => s.id !== "demo")
                  .map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td>{s.automation === "api" ? <Badge tone="info">Automatisch (API)</Badge> : <Badge tone="neutral">Handmatig</Badge>}</td>
                      <td className="max-w-md text-muted">{s.coverageNote}</td>
                      <td>{s.automation === "api" ? (s.lastSuccessAt ? formatBrussels(s.lastSuccessAt) : <span className="text-warn-700">nog geen</span>) : "n.v.t."}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="aanvraag" className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-xl font-semibold text-navy-900">Pilot aanvragen</h2>
            <p className="mt-2 text-sm text-muted">
              We nemen beperkt pilotklanten op. Laat uw gegevens achter; we nemen persoonlijk contact op. We gebruiken deze gegevens enkel om uw aanvraag
              te behandelen en bewaren ze niet langer dan nodig.
            </p>
          </div>
          <form action={createLeadAction} className="space-y-3 rounded-lg border border-line bg-white p-5">
            {sp.ok && <Notice tone="ok">{sp.ok}</Notice>}
            {sp.fout && <Notice tone="bad">{sp.fout}</Notice>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="companyName">Bedrijfsnaam *</label>
                <input id="companyName" name="companyName" type="text" required maxLength={200} />
              </div>
              <div className="space-y-1">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="url" placeholder="https://" maxLength={300} />
              </div>
              <div className="space-y-1">
                <label htmlFor="contactName">Contactpersoon *</label>
                <input id="contactName" name="contactName" type="text" required maxLength={200} />
              </div>
              <div className="space-y-1">
                <label htmlFor="email">E-mailadres *</label>
                <input id="email" name="email" type="email" required maxLength={200} />
              </div>
              <div className="space-y-1">
                <label htmlFor="teamSize">Teamgrootte</label>
                <select id="teamSize" name="teamSize" defaultValue="">
                  <option value="">—</option>
                  <option>1–2</option>
                  <option>3–10</option>
                  <option>11–30</option>
                  <option>meer dan 30</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="focus">Belangrijkste focus</label>
                <input id="focus" name="focus" type="text" maxLength={200} placeholder="bv. Databricks, Fabric" />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="message">Toelichting</label>
              <textarea id="message" name="message" maxLength={2000} />
            </div>
            <label className="flex items-start gap-2 text-sm font-normal">
              <input type="checkbox" name="consent" required className="mt-1" />
              <span>Ik ga akkoord dat TenderKompas IT deze gegevens gebruikt om contact op te nemen over de pilot.</span>
            </label>
            {/* Honeypot tegen spam */}
            <input type="text" name="bedrijf_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <button type="submit" className={btn("primary")}>Aanvraag versturen</button>
          </form>
        </section>
      </main>
      <footer className="border-t border-line bg-white py-6 text-center text-xs text-muted">
        TenderKompas IT — pilotversie. Geen garantie op volledigheid, toelating of gunning.
      </footer>
    </div>
  );
}
