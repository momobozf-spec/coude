/**
 * Leesbare namen voor de enums.
 *
 * Bewust in het domein en niet in een component: het label van een constructie
 * hoort overal hetzelfde te zijn, en een tweede vertaling in een andere
 * component is een tweede waarheid.
 *
 * Let op de formuleringen: ze beschrijven de CONTRACTVORM, niet een religieus
 * oordeel. "Murabaha" is een constructie, geen keurmerk.
 */
import { FinancingQuoteStatus, FinancingType } from '@prisma/client'

export const FINANCING_TYPE_LABELS: Record<FinancingType, string> = {
  MURABAHA: 'Murabaha',
  IJARA: 'Ijara',
  DIMINISHING_MUSHARAKA: 'Afnemend partnerschap',
  ISTISNA: 'Istisna',
  QARD_HASAN: 'Renteloze lening',
  CONVENTIONAL_MORTGAGE: 'Klassiek hypothecair krediet',
  OTHER: 'Andere constructie',
}

/** Eén zin over hoe de constructie werkt. Redactionele tekst, geen AI. */
export const FINANCING_TYPE_SUMMARIES: Record<FinancingType, string> = {
  MURABAHA:
    'De financier koopt de woning en verkoopt hem aan jou door tegen een vooraf vastgelegde totaalprijs.',
  IJARA:
    'De financier is eigenaar en jij huurt, met een afspraak dat de eigendom uiteindelijk naar jou overgaat.',
  DIMINISHING_MUSHARAKA:
    'Je koopt de woning samen met de financier en neemt zijn aandeel maandelijks over.',
  ISTISNA: 'Financiering voor een woning die nog gebouwd moet worden.',
  QARD_HASAN: 'Een lening zonder vergoeding op het geleende bedrag.',
  CONVENTIONAL_MORTGAGE:
    'Een gewone woonlening met rente. Opgenomen als referentiepunt, niet als aanbeveling.',
  OTHER: 'De aanbieder omschrijft deze constructie op zijn eigen manier.',
}

/**
 * Waar de gebruiker staat met een product.
 *
 * `SELECTED` heet bewust "Mijn keuze" en niet "Goedgekeurd": dit platform
 * beslist niet over goedkeuring, de aanbieder doet dat.
 */
export const QUOTE_STATUS_LABELS: Record<FinancingQuoteStatus, string> = {
  DRAFT: 'Berekening',
  INTERESTED: 'Interessant',
  SHORTLISTED: 'Op shortlist',
  SELECTED: 'Mijn keuze',
  REJECTED: 'Afgevallen',
}

export const QUOTE_STATUS_HINTS: Record<FinancingQuoteStatus, string> = {
  DRAFT: 'Bewaard, nog geen oordeel.',
  INTERESTED: 'Je wil dit product verder bekijken.',
  SHORTLISTED: 'Een van je serieuze opties.',
  SELECTED:
    'De optie waarmee je verder wil. Dit betekent niet dat je financiering is goedgekeurd — dat beslist de aanbieder.',
  REJECTED: 'Niet geschikt voor jouw situatie.',
}
