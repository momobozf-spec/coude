import 'server-only';

import type { Locale } from '@/i18n/config';
import { DISCLAIMER } from '@/lib/legal/disclaimer';
import {
  A4,
  COLORS,
  MARGIN,
  PdfBuilder,
  toEmbeddable,
} from '@/lib/pdf/builder';
import type {
  Inspection,
  InspectionPhoto,
  PhotoComparison,
  Property,
} from '@/lib/supabase/types';

const COPY = {
  nl: {
    title: 'Vergelijkend rapport intrek — vertrek',
    property: 'Woning',
    checkInDate: 'Plaatsbeschrijving bij intrek',
    checkOutDate: 'Plaatsbeschrijving bij vertrek',
    occupancy: 'Bewoningsduur',
    months: 'maanden',
    tenant: 'Huurder',
    generatedAt: 'Rapport gegenereerd op',
    pairs: 'Aantal vergeleken fotoparen',
    howToRead: 'Hoe u dit rapport leest',
    howToReadBody:
      'Voor elk fotopaar staat hieronder het oordeel van de huurder. Dat is het ' +
      'oordeel dat telt in dit rapport. Waar een geautomatiseerde analyse is ' +
      'uitgevoerd, staat die als bijlage achteraan, ook wanneer de huurder haar ' +
      'heeft tegengesproken. Een analyse is een hulpmiddel, geen vaststelling.',
    vetusteTitle: 'Over de slijtageverdeling',
    vetusteBody:
      'Waar een herstelkost verdeeld is, gebeurde dat volgens de indicatieve ' +
      'slijtagegrille van het Waals Gewest. Er bestaat geen Brussels ' +
      'equivalent. Een Brusselse rechter is niet aan die grille gebonden. De ' +
      'bedragen komen uit offertes die de huurder heeft ingevoerd.',
    checkIn: 'Bij intrek',
    checkOut: 'Bij vertrek',
    verdict: 'Oordeel van de huurder',
    note: 'Toelichting',
    noNote: 'Geen toelichting.',
    notReviewed: 'Nog niet beoordeeld door de huurder.',
    classification: {
      WEAR_AND_TEAR: 'Normale slijtage',
      DAMAGE: 'Schade',
      UNCLEAR: 'Onduidelijk',
    },
    costTitle: 'Kostenverdeling',
    repairCost: 'Herstelkost volgens offerte',
    abattement: 'Afschrijving wegens slijtage',
    tenantShare: 'Aandeel huurder',
    landlordShare: 'Aandeel verhuurder',
    exclusion: 'Grille niet toegepast wegens',
    summaryTitle: 'Samenvatting',
    totalDamage: 'Aantal punten dat de huurder als schade beoordeelt',
    totalWear: 'Aantal punten dat de huurder als normale slijtage beoordeelt',
    totalUnclear: 'Aantal punten dat onduidelijk blijft',
    totalTenant: 'Totaal aandeel huurder over de berekende punten',
    totalLandlord: 'Totaal aandeel verhuurder over de berekende punten',
    summaryCaveat:
      'Deze totalen dekken alleen de punten waarvoor een herstelkost is ' +
      'ingevoerd. Ze zijn geen eindafrekening.',
    unmatchedTitle: 'Foto’s zonder tegenhanger',
    unmatchedBody:
      'Voor deze foto’s was geen vergelijking mogelijk, omdat er geen foto van ' +
      'dezelfde plek uit de andere plaatsbeschrijving beschikbaar was.',
    annexTitle: 'Bijlage — geautomatiseerde analyses',
    annexBody:
      'Hieronder staat wat de geautomatiseerde analyse per fotopaar heeft ' +
      'vastgesteld, met de zekerheid die zij daaraan gaf. Waar de huurder tot ' +
      'een ander oordeel kwam, telt het oordeel van de huurder.',
    aiClassification: 'Analyse',
    confidence: 'Zekerheid',
    observed: 'Waargenomen verschillen',
    notAnalyzed: 'Niet automatisch geanalyseerd.',
    refused: 'De analyse kon dit fotopaar niet beoordelen.',
    forcedUnclear:
      'De analyse was te onzeker en is daarom automatisch op onduidelijk gezet.',
    model: 'Model',
    imageUnavailable: 'De afbeelding kon niet worden weergegeven.',
  },
  fr: {
    title: 'Rapport comparatif entrée — sortie',
    property: 'Logement',
    checkInDate: "État des lieux d'entrée",
    checkOutDate: 'État des lieux de sortie',
    occupancy: "Durée d'occupation",
    months: 'mois',
    tenant: 'Locataire',
    generatedAt: 'Rapport généré le',
    pairs: 'Nombre de paires comparées',
    howToRead: 'Comment lire ce rapport',
    howToReadBody:
      "Pour chaque paire figure ci-dessous l'appréciation du locataire. C'est " +
      "elle qui compte dans ce rapport. Lorsqu'une analyse automatisée a été " +
      'effectuée, elle figure en annexe à la fin, y compris lorsque le ' +
      "locataire l'a contredite. Une analyse est un outil d'aide, pas une " +
      'constatation.',
    vetusteTitle: 'À propos de la répartition pour vétusté',
    vetusteBody:
      "Lorsqu'un coût de réparation a été réparti, cela s'est fait selon la " +
      'grille indicative de vétusté de la Région wallonne. Il n’existe pas ' +
      "d'équivalent bruxellois. Un juge bruxellois n'est pas lié par cette " +
      'grille. Les montants proviennent de devis encodés par le locataire.',
    checkIn: "À l'entrée",
    checkOut: 'À la sortie',
    verdict: 'Appréciation du locataire',
    note: 'Commentaire',
    noNote: 'Pas de commentaire.',
    notReviewed: 'Pas encore évalué par le locataire.',
    classification: {
      WEAR_AND_TEAR: 'Usure normale',
      DAMAGE: 'Dégât',
      UNCLEAR: 'Incertain',
    },
    costTitle: 'Répartition du coût',
    repairCost: 'Coût de réparation selon devis',
    abattement: 'Abattement pour vétusté',
    tenantShare: 'Part du locataire',
    landlordShare: 'Part du bailleur',
    exclusion: 'Grille non appliquée en raison de',
    summaryTitle: 'Synthèse',
    totalDamage: 'Nombre de points que le locataire qualifie de dégât',
    totalWear: "Nombre de points que le locataire qualifie d'usure normale",
    totalUnclear: 'Nombre de points qui restent incertains',
    totalTenant: 'Total de la part du locataire sur les points calculés',
    totalLandlord: 'Total de la part du bailleur sur les points calculés',
    summaryCaveat:
      'Ces totaux ne couvrent que les points pour lesquels un coût de ' +
      "réparation a été encodé. Ils ne constituent pas un décompte final.",
    unmatchedTitle: 'Photos sans correspondance',
    unmatchedBody:
      "Aucune comparaison n'était possible pour ces photos, faute de photo du " +
      "même endroit dans l'autre état des lieux.",
    annexTitle: 'Annexe — analyses automatisées',
    annexBody:
      "Vous trouverez ci-dessous ce que l'analyse automatisée a constaté pour " +
      "chaque paire, avec le degré de certitude qu'elle y a attaché. Lorsque le " +
      "locataire est arrivé à une autre appréciation, c'est la sienne qui compte.",
    aiClassification: 'Analyse',
    confidence: 'Certitude',
    observed: 'Différences observées',
    notAnalyzed: 'Pas analysé automatiquement.',
    refused: "L'analyse n'a pas pu évaluer cette paire.",
    forcedUnclear:
      "L'analyse était trop incertaine et a donc été placée automatiquement sur " +
      'incertain.',
    model: 'Modèle',
    imageUnavailable: "L'image n'a pas pu être affichée.",
  },
} as const;

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-BE' : 'fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function euro(cents: number | null, locale: Locale): string {
  if (cents === null) return '—';
  return new Intl.NumberFormat(locale === 'nl' ? 'nl-BE' : 'fr-BE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export interface ComparisonEntry {
  comparison: PhotoComparison;
  roomLabel: string;
  slotLabel: string;
  checkInPhoto: InspectionPhoto;
  checkOutPhoto: InspectionPhoto;
  checkInBytes: Uint8Array | null;
  checkOutBytes: Uint8Array | null;
  vetusteLabel: string | null;
}

export interface ComparisonReportInput {
  locale: Locale;
  property: Property;
  checkIn: Inspection;
  checkOut: Inspection;
  entries: ComparisonEntry[];
  unmatched: { roomLabel: string; slotLabel: string; side: 'CHECK_IN' | 'CHECK_OUT' }[];
  monthsOccupied: number | null;
  tenantName: string;
}

export async function buildComparisonReport({
  locale,
  property,
  checkIn,
  checkOut,
  entries,
  unmatched,
  monthsOccupied,
  tenantName,
}: ComparisonReportInput): Promise<Uint8Array> {
  const t = COPY[locale];
  const pdf = await PdfBuilder.create(DISCLAIMER[locale]);

  // -- Titelblad -----------------------------------------------------------
  pdf.heading(t.title, 19);
  pdf.move(6);

  pdf.keyValue(
    t.property,
    `${property.address}, ${property.postal_code} ${property.municipality}`,
  );
  pdf.keyValue(t.tenant, tenantName);
  pdf.keyValue(t.checkInDate, formatDate(checkIn.inspection_date, locale));
  pdf.keyValue(t.checkOutDate, formatDate(checkOut.inspection_date, locale));
  pdf.keyValue(
    t.occupancy,
    monthsOccupied === null ? '—' : `${monthsOccupied} ${t.months}`,
  );
  pdf.keyValue(t.pairs, String(entries.length));
  pdf.keyValue(t.generatedAt, formatDate(new Date().toISOString(), locale));
  pdf.move(8);

  pdf.box(t.howToRead, [t.howToReadBody]);
  pdf.box(t.vetusteTitle, [t.vetusteBody], 'warning');

  // -- Samenvatting --------------------------------------------------------
  const verdicts = entries.map((entry) => entry.comparison.user_verdict);
  const tenantTotal = entries.reduce(
    (sum, entry) => sum + (entry.comparison.tenant_share_cents ?? 0),
    0,
  );
  const landlordTotal = entries.reduce(
    (sum, entry) => sum + (entry.comparison.landlord_share_cents ?? 0),
    0,
  );
  const hasCosts = entries.some(
    (entry) => entry.comparison.tenant_share_cents !== null,
  );

  pdf.newPage();
  pdf.heading(t.summaryTitle, 15);
  pdf.keyValue(
    t.totalDamage,
    String(verdicts.filter((verdict) => verdict === 'DAMAGE').length),
  );
  pdf.keyValue(
    t.totalWear,
    String(verdicts.filter((verdict) => verdict === 'WEAR_AND_TEAR').length),
  );
  pdf.keyValue(
    t.totalUnclear,
    String(verdicts.filter((verdict) => verdict !== 'DAMAGE' && verdict !== 'WEAR_AND_TEAR').length),
  );

  if (hasCosts) {
    pdf.move(4);
    pdf.keyValue(t.totalTenant, euro(tenantTotal, locale));
    pdf.keyValue(t.totalLandlord, euro(landlordTotal, locale));
    pdf.move(4);
    pdf.box(t.summaryTitle, [t.summaryCaveat], 'warning');
  }

  // -- Per fotopaar --------------------------------------------------------
  for (const entry of entries) {
    pdf.newPage();
    pdf.heading(`${entry.roomLabel} — ${entry.slotLabel}`, 14);

    await drawSideBySide(pdf, entry, t);

    const verdict = entry.comparison.user_verdict;
    pdf.paragraph(
      `${t.verdict}: ${verdict ? t.classification[verdict] : t.notReviewed}`,
      { font: pdf.fonts.bold, size: 11 },
    );

    pdf.paragraph(`${t.note}: ${entry.comparison.user_note ?? t.noNote}`, {
      size: 10,
      color: entry.comparison.user_note ? COLORS.text : COLORS.muted,
    });

    if (entry.comparison.vetuste_calculated_at) {
      pdf.move(6);
      pdf.paragraph(t.costTitle, { font: pdf.fonts.bold, size: 11 });
      if (entry.vetusteLabel) {
        pdf.keyValue(t.costTitle, entry.vetusteLabel);
      }
      pdf.keyValue(
        t.repairCost,
        euro(entry.comparison.repair_cost_cents, locale),
      );
      if (entry.comparison.vetuste_exclusion) {
        pdf.keyValue(t.exclusion, entry.comparison.vetuste_exclusion);
      } else {
        pdf.keyValue(
          t.abattement,
          `${entry.comparison.vetuste_abattement_pct ?? 0}%`,
        );
      }
      pdf.keyValue(
        t.tenantShare,
        euro(entry.comparison.tenant_share_cents, locale),
      );
      pdf.keyValue(
        t.landlordShare,
        euro(entry.comparison.landlord_share_cents, locale),
      );
    }
  }

  // -- Foto's zonder tegenhanger -------------------------------------------
  if (unmatched.length > 0) {
    pdf.newPage();
    pdf.heading(t.unmatchedTitle, 15);
    pdf.paragraph(t.unmatchedBody);
    pdf.move(4);
    pdf.bullets(
      unmatched.map(
        (item) =>
          `${item.roomLabel} — ${item.slotLabel} (${
            item.side === 'CHECK_IN' ? t.checkIn : t.checkOut
          })`,
      ),
    );
  }

  // -- Bijlage: AI-analyses ------------------------------------------------
  const analysed = entries.filter(
    (entry) => entry.comparison.ai_analyzed_at !== null,
  );

  pdf.newPage();
  pdf.heading(t.annexTitle, 15);
  pdf.paragraph(t.annexBody);
  pdf.move(4);

  if (analysed.length === 0) {
    pdf.paragraph(t.notAnalyzed, { color: COLORS.muted });
  }

  for (const entry of analysed) {
    const comparison = entry.comparison;
    pdf.ensure(90);
    pdf.divider();
    pdf.paragraph(`${entry.roomLabel} — ${entry.slotLabel}`, {
      font: pdf.fonts.bold,
      size: 11,
    });

    if (comparison.ai_refused) {
      pdf.paragraph(t.refused, { size: 10, color: COLORS.muted });
      continue;
    }

    pdf.paragraph(
      `${t.aiClassification}: ${
        comparison.ai_classification
          ? t.classification[comparison.ai_classification]
          : '—'
      }  |  ${t.confidence}: ${
        comparison.ai_confidence !== null
          ? `${Math.round(comparison.ai_confidence * 100)}%`
          : '—'
      }`,
      { size: 10 },
    );

    if (comparison.ai_forced_unclear) {
      pdf.paragraph(t.forcedUnclear, { size: 9, color: COLORS.warning });
    }

    if (comparison.ai_notes) {
      pdf.paragraph(comparison.ai_notes, { size: 10 });
    }

    const differences = comparison.ai_observed_differences ?? [];
    if (differences.length > 0) {
      pdf.paragraph(t.observed, { size: 9, font: pdf.fonts.bold });
      pdf.bullets(differences, { size: 9 });
    }

    pdf.paragraph(
      `${t.model}: ${comparison.ai_provider ?? '—'} / ${comparison.ai_model ?? '—'}`,
      { size: 8, color: COLORS.muted },
    );
    pdf.move(4);
  }

  return pdf.save();
}

async function drawSideBySide(
  pdf: PdfBuilder,
  entry: ComparisonEntry,
  t: (typeof COPY)[Locale],
): Promise<void> {
  const columnWidth = (A4.width - MARGIN * 2 - 12) / 2;
  const maxHeight = 210;

  const embedded = await Promise.all(
    [entry.checkInBytes, entry.checkOutBytes].map(async (bytes, index) => {
      if (!bytes) return null;
      const contentType =
        index === 0
          ? entry.checkInPhoto.content_type
          : entry.checkOutPhoto.content_type;
      const converted = await toEmbeddable(bytes, contentType, 1000);
      if (!converted) return null;
      try {
        return converted.format === 'png'
          ? await pdf.doc.embedPng(converted.bytes)
          : await pdf.doc.embedJpg(converted.bytes);
      } catch {
        return null;
      }
    }),
  );

  const heights = embedded.map((image) =>
    image
      ? image.height * Math.min(columnWidth / image.width, maxHeight / image.height, 1)
      : 60,
  );
  const rowHeight = Math.max(...heights);

  pdf.ensure(rowHeight + 34);

  const top = pdf.y;

  [t.checkIn, t.checkOut].forEach((title, index) => {
    pdf.currentPage.drawText(title, {
      x: MARGIN + index * (columnWidth + 12),
      y: top - 10,
      size: 9,
      font: pdf.fonts.bold,
      color: COLORS.muted,
    });
  });

  embedded.forEach((image, index) => {
    const x = MARGIN + index * (columnWidth + 12);
    if (!image) {
      pdf.currentPage.drawText(t.imageUnavailable, {
        x,
        y: top - 34,
        size: 8,
        font: pdf.fonts.regular,
        color: COLORS.warning,
      });
      return;
    }

    const scale = Math.min(
      columnWidth / image.width,
      maxHeight / image.height,
      1,
    );
    const width = image.width * scale;
    const height = image.height * scale;

    pdf.currentPage.drawImage(image, { x, y: top - 18 - height, width, height });
  });

  pdf.move(rowHeight + 30);
}
