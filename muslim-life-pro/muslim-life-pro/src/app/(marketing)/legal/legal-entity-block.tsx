import { legalEntity, legalTextsReviewed } from '@/config/legal'

/** Languages the legal texts exist in. Arabic readers get the English text. */
export type LegalLang = 'en' | 'nl' | 'fr'

export function legalLang(locale: string): LegalLang {
  return locale === 'nl' || locale === 'fr' ? locale : 'en'
}

const LABELS: Record<LegalLang, { office: string; vat: string; contact: string }> = {
  en: { office: 'Registered office', vat: 'Enterprise / VAT number', contact: 'Contact' },
  nl: { office: 'Maatschappelijke zetel', vat: 'Ondernemingsnummer / btw', contact: 'Contact' },
  fr: { office: 'Siège social', vat: "Numéro d'entreprise / TVA", contact: 'Contact' },
}

/** The operator's identity (src/config/legal.ts). The street address comes from LEGAL_ENTITY_ADDRESS. */
export function LegalEntityBlock({ lang = 'en' }: { lang?: LegalLang }) {
  const legal = legalEntity()
  const l = LABELS[lang]

  return (
    <div className="rounded-xl border border-border bg-surface-sunken p-5 text-sm leading-relaxed">
      <p className="font-medium">{legal.name}</p>
      <p>
        {l.vat}: {legal.vat}
      </p>
      <p>
        {l.office}: {legal.displayAddress}
      </p>
      <p>
        {l.contact}:{' '}
        <a className="text-primary hover:underline" href={`mailto:${legal.email}`}>
          {legal.email}
        </a>
      </p>
    </div>
  )
}

const CONCEPT: Record<LegalLang, string> = {
  en: 'Draft — to be reviewed by a lawyer.',
  nl: 'Concept — laten nalezen door een jurist.',
  fr: 'Concept — à faire relire par un juriste.',
}

/** Shown at the top of every legal text until LEGAL_TEXTS_REVIEWED=1. */
export function ConceptNotice({ lang = 'en' }: { lang?: LegalLang }) {
  if (legalTextsReviewed()) return null
  return (
    <p className="rounded-lg border border-warning/40 bg-warning-subtle p-3 text-xs font-medium">{CONCEPT[lang]}</p>
  )
}
