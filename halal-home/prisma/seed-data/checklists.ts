/**
 * Checklists als data.
 *
 * Deze staan bewust NIET in een React-component. Het aankoopproces verschilt
 * per gewest en verandert wanneer de regelgeving verandert; een checklist
 * bijwerken hoort een INSERT te zijn, geen release.
 *
 * Elk item heeft een stabiele `key`. Daarop koppelen we geüploade documenten
 * (`Document.checklistItemKey`) en de voortgang van de gebruiker, zodat het
 * hernoemen van een label geen data breekt.
 */
import {
  ChecklistImportance,
  ChecklistScope,
  DocumentCategory,
  JourneyStage,
  PurchaseType,
} from '@prisma/client'

export interface SeedChecklistItem {
  key: string
  title: string
  description?: string
  section?: string
  importance?: ChecklistImportance
  documentCategory?: DocumentCategory
  termSlug?: string
  helpText?: string
}

export interface SeedChecklistTemplate {
  key: string
  name: string
  description?: string
  scope: ChecklistScope
  country: string
  region?: string
  stage?: JourneyStage
  purchaseType?: PurchaseType
  sortOrder: number
  sourceUrl?: string
  disclaimer?: string
  items: SeedChecklistItem[]
}

export const BE_CHECKLISTS: SeedChecklistTemplate[] = [
  // ── Documenten voor de financiering ────────────────────────────────────────
  {
    key: 'be.documents.financing',
    name: 'Documenten voor je financiering',
    description: 'Wat vrijwel elke aanbieder van je vraagt bij een aanvraag.',
    scope: ChecklistScope.DOCUMENTS,
    country: 'BE',
    stage: JourneyStage.FINANCING,
    sortOrder: 10,
    items: [
      {
        key: 'doc.identity_card',
        title: 'Identiteitskaart (voor- en achterkant)',
        section: 'Identiteit',
        documentCategory: DocumentCategory.IDENTITY,
      },
      {
        key: 'doc.payslips',
        title: 'Laatste 3 loonfiches',
        description: 'Zelfstandig? Dan meestal je laatste twee aanslagbiljetten.',
        section: 'Inkomen',
        documentCategory: DocumentCategory.INCOME,
      },
      {
        key: 'doc.tax_assessment',
        title: 'Recentste aanslagbiljet personenbelasting',
        section: 'Inkomen',
        documentCategory: DocumentCategory.INCOME,
      },
      {
        key: 'doc.bank_statements',
        title: 'Bankafschriften van de laatste 3 maanden',
        section: 'Bank',
        documentCategory: DocumentCategory.BANK,
      },
      {
        key: 'doc.own_funds_proof',
        title: 'Bewijs van je eigen middelen',
        description: 'Spaarrekening, schenkingsakte of verkoopbelofte van een andere woning.',
        section: 'Bank',
        documentCategory: DocumentCategory.BANK,
      },
      {
        key: 'doc.existing_credits',
        title: 'Overzicht van je lopende kredieten',
        description: 'Autolening, renovatiekrediet, kredietopening.',
        section: 'Bank',
        importance: ChecklistImportance.OPTIONAL,
        documentCategory: DocumentCategory.FINANCING,
      },
    ],
  },

  // ── Notaris ────────────────────────────────────────────────────────────────
  {
    key: 'be.notary.deed',
    name: 'Klaar voor de notaris',
    description: 'Wat er vóór, tijdens en na de akte geregeld moet zijn.',
    scope: ChecklistScope.NOTARY,
    country: 'BE',
    stage: JourneyStage.NOTARY,
    sortOrder: 20,
    sourceUrl: 'https://www.notaris.be/',
    items: [
      // Voor de afspraak
      {
        key: 'notary.identity',
        title: 'Identiteitsdocumenten van alle kopers',
        section: 'Voor de afspraak',
        documentCategory: DocumentCategory.IDENTITY,
      },
      {
        key: 'notary.purchase_agreement',
        title: 'Getekende koopovereenkomst (compromis)',
        section: 'Voor de afspraak',
        documentCategory: DocumentCategory.PURCHASE_AGREEMENT,
        termSlug: 'compromis-de-vente',
      },
      {
        key: 'notary.financing_proof',
        title: 'Financieringsbewijs of kredietaanbod',
        section: 'Voor de afspraak',
        documentCategory: DocumentCategory.FINANCING,
      },
      {
        key: 'notary.insurance_info',
        title: 'Gegevens van je brandverzekering',
        section: 'Voor de afspraak',
        documentCategory: DocumentCategory.INSURANCE,
        termSlug: 'brandverzekering',
      },
      {
        key: 'notary.marriage_contract',
        title: 'Huwelijkscontract of samenlevingscontract',
        description: 'Alleen als je gehuwd bent of wettelijk samenwoont.',
        section: 'Voor de afspraak',
        importance: ChecklistImportance.OPTIONAL,
      },

      // Te controleren
      {
        key: 'notary.title_deed',
        title: 'Eigendomstitel van de verkoper',
        section: 'Te controleren',
      },
      {
        key: 'notary.urban_info',
        title: 'Stedenbouwkundige inlichtingen',
        section: 'Te controleren',
        termSlug: 'stedenbouwkundige-inlichtingen',
        helpText: 'Kijk of alles wat er staat ook vergund is.',
      },
      {
        key: 'notary.soil_certificate',
        title: 'Bodemattest',
        section: 'Te controleren',
        termSlug: 'bodemattest',
      },
      {
        key: 'notary.epc',
        title: 'EPC',
        section: 'Te controleren',
        termSlug: 'epc',
        documentCategory: DocumentCategory.PROPERTY,
      },
      {
        key: 'notary.electrical_inspection',
        title: 'Keuringsverslag elektriciteit',
        section: 'Te controleren',
        termSlug: 'elektrische-keuring',
        documentCategory: DocumentCategory.PROPERTY,
      },
      {
        key: 'notary.fuel_tank',
        title: 'Keuring van de stookolietank',
        description: 'Alleen bij een woning met mazoutverwarming.',
        section: 'Te controleren',
        importance: ChecklistImportance.OPTIONAL,
      },
      {
        key: 'notary.syndic_documents',
        title: 'Documenten van de vereniging van mede-eigenaars',
        description: 'Alleen bij een appartement: reglement, verslagen, reservefonds.',
        section: 'Te controleren',
        importance: ChecklistImportance.OPTIONAL,
      },

      // Na de akte
      {
        key: 'notary.utilities_transfer',
        title: 'Nutsvoorzieningen op je naam zetten',
        section: 'Na de akte',
      },
      {
        key: 'notary.address_change',
        title: 'Adreswijziging bij de gemeente',
        description: 'Binnen acht dagen na de verhuis.',
        section: 'Na de akte',
      },
      {
        key: 'notary.insurance_active',
        title: 'Brandverzekering actief vanaf de aktedatum',
        section: 'Na de akte',
        documentCategory: DocumentCategory.INSURANCE,
      },
    ],
  },

  // ── Verhuizen ──────────────────────────────────────────────────────────────
  {
    key: 'be.moving',
    name: 'Verhuischecklist',
    scope: ChecklistScope.MOVING,
    country: 'BE',
    stage: JourneyStage.MOVING,
    sortOrder: 30,
    items: [
      { key: 'moving.book_company', title: 'Verhuisfirma of bestelwagen boeken', section: 'Voor de verhuis' },
      { key: 'moving.internet', title: 'Internet regelen op het nieuwe adres', section: 'Voor de verhuis' },
      { key: 'moving.energy', title: 'Energiecontract regelen', section: 'Voor de verhuis' },
      { key: 'moving.water', title: 'Water regelen', section: 'Voor de verhuis' },
      {
        key: 'moving.fire_insurance',
        title: 'Brandverzekering in orde brengen',
        section: 'Voor de verhuis',
        documentCategory: DocumentCategory.INSURANCE,
      },
      { key: 'moving.address_prepare', title: 'Adreswijziging voorbereiden', section: 'Voor de verhuis' },
      {
        key: 'moving.meter_readings',
        title: 'Meterstanden fotograferen',
        description: 'Samen met de verkoper, op de dag van de sleuteloverdracht.',
        section: 'Verhuisdag',
      },
      { key: 'moving.check_keys', title: 'Alle sleutels controleren', section: 'Verhuisdag' },
      {
        key: 'moving.address_official',
        title: 'Adres officieel wijzigen bij de gemeente',
        section: 'Na de verhuis',
      },
      { key: 'moving.notify_bank', title: 'Bank informeren', section: 'Na de verhuis' },
      { key: 'moving.notify_employer', title: 'Werkgever informeren', section: 'Na de verhuis' },
      { key: 'moving.notify_mutuality', title: 'Ziekenfonds informeren', section: 'Na de verhuis' },
      { key: 'moving.update_insurance', title: 'Verzekeringen aanpassen', section: 'Na de verhuis' },
    ],
  },
]
