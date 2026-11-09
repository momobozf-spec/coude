import Link from "next/link";
import { LegalFooter } from "@/components/legal-footer";

/** Opmaak voor de juridische pagina's (voorwaarden, privacy). */
export function LegalPage({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-navy-900">
            TenderKompas IT
          </Link>
          <Link href="/login" className="text-sm text-navy-700 hover:underline">
            Aanmelden
          </Link>
        </div>
      </header>
      <main className="legal mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-sm leading-relaxed">
        <p className="mb-4 rounded-md border border-warn-700/30 bg-warn-50 px-3 py-2 text-warn-700">
          <strong>Concept — laten nalezen door een jurist.</strong> {version}
        </p>
        <h1 className="mb-6 text-2xl font-semibold text-navy-900">{title}</h1>
        <div className="space-y-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy-900 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function EntityBlock({ address }: { address: string }) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
      <dt className="font-semibold">Onderneming</dt>
      <dd>Marhaba Data &amp; AI Agent BV (besloten vennootschap)</dd>
      <dt className="font-semibold">Zetel</dt>
      <dd>{address}</dd>
      <dt className="font-semibold">Ondernemingsnummer / btw</dt>
      <dd>BE 1003.552.102</dd>
      <dt className="font-semibold">E-mail</dt>
      <dd>
        <a className="underline" href="mailto:momobozf@gmail.com">
          momobozf@gmail.com
        </a>
      </dd>
    </dl>
  );
}
