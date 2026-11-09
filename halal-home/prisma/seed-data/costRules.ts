/**
 * Aankoopkosten per gewest — ONTWIKKELWAARDEN.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  LEES DIT VOORDAT JE HIEROP VERTROUWT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * De percentages hieronder zijn ontwikkelwaarden. Ze staan in de seed zodat de
 * kostenraming iets te tonen heeft, NIET omdat ze geverifieerd zijn.
 *
 * Registratierechten in België zijn de afgelopen jaren meermaals gewijzigd en
 * verschillen per gewest, per situatie (enige eigen woning, ingrijpende
 * energetische renovatie, sociale woning) en per moment. Elke rij hieronder
 * heeft daarom een `sourceUrl` en `lastVerifiedAt` van `null` — de UI hoort
 * dat te tonen als "niet nagekeken".
 *
 * VOOR PRODUCTIE: laat iemand de tarieven nakijken bij de belastingdienst van
 * het gewest, vul `lastVerifiedAt` in, en zet `validUntil` op de oude rij in
 * plaats van hem te overschrijven. Dat is het hele punt van deze tabel: de
 * geschiedenis blijft kloppen voor wie vorig jaar een raming maakte.
 */
import type { CostRuleConfiguration, CostRuleType } from '@/modules/financing/domain/costRules'

export interface SeedCostRule {
  country: string
  region: string | null
  ruleType: CostRuleType
  validFrom: Date
  validUntil: Date | null
  configuration: CostRuleConfiguration
  sourceUrl: string | null
  notes: string
}

const NOT_VERIFIED =
  'ONTWIKKELWAARDE — niet nagekeken. Controleer bij de belastingdienst van het gewest ' +
  'of bij je notaris voordat je hierop rekent.'

/**
 * Notarieel ereloon volgt in België een wettelijk schijventarief. De schijven
 * hieronder zijn een vereenvoudiging voor de ontwikkelomgeving.
 */
const NOTARY_BRACKETS: CostRuleConfiguration = {
  kind: 'BRACKETED',
  brackets: [
    { upTo: 7_500, basisPoints: 456 },
    { upTo: 17_500, basisPoints: 285 },
    { upTo: 30_000, basisPoints: 228 },
    { upTo: 45_495, basisPoints: 171 },
    { upTo: 64_275, basisPoints: 114 },
    { upTo: 250_095, basisPoints: 57 },
    { upTo: null, basisPoints: 5 },
  ],
  minimumAmount: 1_000,
}

const from = new Date('2024-01-01T00:00:00.000Z')

export const BE_COST_RULES: SeedCostRule[] = [
  // ── Vlaanderen ────────────────────────────────────────────────────────────
  {
    country: 'BE',
    region: 'FLANDERS',
    ruleType: 'REGISTRATION_DUTY',
    validFrom: from,
    validUntil: null,
    configuration: {
      kind: 'FLAT_PERCENTAGE',
      basisPoints: 1200,
      firstHomeBasisPoints: 200,
    },
    sourceUrl: 'https://www.vlaanderen.be/verkooprecht',
    notes: NOT_VERIFIED,
  },
  {
    country: 'BE',
    region: 'BRUSSELS',
    ruleType: 'REGISTRATION_DUTY',
    validFrom: from,
    validUntil: null,
    configuration: {
      kind: 'FLAT_PERCENTAGE',
      basisPoints: 1250,
      // Brussel werkt met een abattement: niet het tarief daalt, de grondslag
      // doet dat. Vandaar een aftrek en geen apart percentage.
      firstHomeBasisPoints: 1250,
      firstHomeBaseDeduction: 200_000,
    },
    sourceUrl: 'https://fiscaliteit.brussels/',
    notes: `${NOT_VERIFIED} Het abattement kent voorwaarden (maximumprijs, domicilieverplichting).`,
  },
  {
    country: 'BE',
    region: 'WALLONIA',
    ruleType: 'REGISTRATION_DUTY',
    validFrom: from,
    validUntil: null,
    configuration: {
      kind: 'FLAT_PERCENTAGE',
      basisPoints: 1250,
      firstHomeBasisPoints: 300,
    },
    sourceUrl: 'https://www.wallonie.be/',
    notes: NOT_VERIFIED,
  },

  // ── Landelijk ─────────────────────────────────────────────────────────────
  {
    country: 'BE',
    region: null,
    ruleType: 'NOTARY_FEE',
    validFrom: from,
    validUntil: null,
    configuration: NOTARY_BRACKETS,
    sourceUrl: 'https://www.notaris.be/',
    notes: `${NOT_VERIFIED} Vereenvoudigd schijventarief; het werkelijke ereloon is wettelijk vastgelegd.`,
  },
  {
    country: 'BE',
    region: null,
    ruleType: 'MORTGAGE_REGISTRATION',
    validFrom: from,
    validUntil: null,
    configuration: {
      // Grondslag is het gefinancierde bedrag, niet de aankoopprijs — dat regelt
      // `applyCostRule` op basis van het ruleType.
      kind: 'FLAT_PERCENTAGE',
      basisPoints: 180,
    },
    sourceUrl: 'https://www.notaris.be/',
    notes: `${NOT_VERIFIED} Bestaat uit registratierecht, ereloon en aktekosten.`,
  },
  {
    country: 'BE',
    region: null,
    ruleType: 'ADMINISTRATIVE_FEE',
    validFrom: from,
    validUntil: null,
    configuration: { kind: 'FIXED_AMOUNT', amount: 1_100 },
    sourceUrl: 'https://www.notaris.be/',
    notes: `${NOT_VERIFIED} Opzoekingen, uittreksels en aktekosten; varieert per dossier.`,
  },
]
