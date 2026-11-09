/**
 * Leesbare namen voor de documentcategorieën.
 *
 * In het domein en niet in een component: dezelfde categorie hoort overal
 * hetzelfde te heten.
 */
import { DocumentCategory } from '@prisma/client'

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  IDENTITY: 'Identiteit',
  INCOME: 'Inkomen',
  BANK: 'Bank',
  FINANCING: 'Financiering',
  PROPERTY: 'Woning en attesten',
  OFFER: 'Bod',
  PURCHASE_AGREEMENT: 'Koopovereenkomst',
  NOTARY: 'Notaris',
  INSURANCE: 'Verzekering',
  TAX: 'Belastingen',
  OTHER: 'Overige',
}

/** Eén zin: waarvoor dient deze categorie? Voor de keuzelijst bij uploaden. */
export const DOCUMENT_CATEGORY_HINTS: Record<DocumentCategory, string> = {
  IDENTITY: 'Identiteitskaart of paspoort van elke koper.',
  INCOME: 'Loonfiches, aanslagbiljet of jaarrekening.',
  BANK: 'Bankafschriften en bewijs van je eigen middelen.',
  FINANCING: 'Aanbod, simulatie of financieringsbewijs van een aanbieder.',
  PROPERTY: 'EPC, bodemattest, keuringsverslag elektriciteit.',
  OFFER: 'Je schriftelijke bod op een woning.',
  PURCHASE_AGREEMENT: 'De verkoopovereenkomst, in België meestal het compromis.',
  NOTARY: 'Documenten van of voor je notaris.',
  INSURANCE: 'Je brandverzekering en andere polissen.',
  TAX: 'Aanslagen en fiscale documenten.',
  OTHER: 'Alles wat nergens anders past.',
}

/** De volgorde waarin categorieën getoond worden: langs het traject. */
export const DOCUMENT_CATEGORY_ORDER: readonly DocumentCategory[] = [
  DocumentCategory.IDENTITY,
  DocumentCategory.INCOME,
  DocumentCategory.BANK,
  DocumentCategory.FINANCING,
  DocumentCategory.OFFER,
  DocumentCategory.PURCHASE_AGREEMENT,
  DocumentCategory.PROPERTY,
  DocumentCategory.NOTARY,
  DocumentCategory.INSURANCE,
  DocumentCategory.TAX,
  DocumentCategory.OTHER,
]

/** Bestandsgrootte, leesbaar. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
