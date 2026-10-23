import 'server-only';

import type { Locale } from '@/i18n/config';
import { DISCLAIMER, EVIDENCE_EXPLAINER, EVIDENCE_LEVELS } from '@/lib/legal/disclaimer';
import { verifyIntegrity } from '@/lib/evidence/hash';
import {
  A4,
  COLORS,
  MARGIN,
  PdfBuilder,
  toEmbeddable,
  toWinAnsi,
} from '@/lib/pdf/builder';
import { roomCompleteness, slotFor, slotLabel } from '@/lib/inspections/rooms';
import type {
  Inspection,
  InspectionPhoto,
  InspectionRoom,
  Property,
} from '@/lib/supabase/types';

const COPY = {
  nl: {
    checkIn: 'Fotodossier bij intrek',
    checkOut: 'Fotodossier bij vertrek',
    property: 'Woning',
    inspectionDate: 'Datum van vaststelling',
    createdBy: 'Opgemaakt door',
    leaseStart: 'Begin huurovereenkomst',
    leaseEnd: 'Einde huurovereenkomst',
    generatedAt: 'Rapport gegenereerd op',
    photoCount: 'Aantal foto’s',
    status: 'Status van dit dossier',
    evidenceTitle: 'Wat dit dossier aantoont — en wat niet',
    proves: 'Dit staat vast',
    doesNotProve: 'Dit staat niet vast',
    howItWorks: 'Hoe de vaststelling werkt',
    howItWorksBody:
      'Bij elke foto berekent onze server op het moment van ontvangst een ' +
      'SHA-256-vingerafdruk over de exacte bytes van het bestand, en legt zij ' +
      'het tijdstip van ontvangst vast. Beide staan bij elke foto in dit ' +
      'rapport. Wie later wil nagaan of een foto gewijzigd is, herberekent de ' +
      'vingerafdruk en vergelijkt.',
    room: 'Kamer',
    roomNotes: 'Notities',
    noNotes: 'Geen notities.',
    missingRecommended: 'Aanbevolen foto’s die ontbreken in deze kamer',
    noPhotosInRoom: 'Er zijn geen foto’s opgenomen voor deze kamer.',
    registeredAt: 'Geregistreerd op onze server',
    capturedAt: 'Opnamedatum volgens het toestel',
    capturedAtCaveat:
      'Deze datum komt uit het bestand zelf en is door de gebruiker te ' +
      'beïnvloeden. Alleen het tijdstip van registratie is door ons vastgesteld.',
    capturedUnknown: 'Niet aanwezig in het bestand',
    hash: 'SHA-256',
    photoNote: 'Notitie',
    imageUnavailable:
      'De afbeelding kon niet in dit rapport worden weergegeven. Het bestand ' +
      'zelf is bewaard; vingerafdruk en tijdstip staan hieronder.',
    integrityFailed:
      'LET OP: de opgeslagen bytes van deze foto komen niet meer overeen met ' +
      'de vingerafdruk die bij de upload werd vastgelegd.',
    indexTitle: 'Overzicht van alle foto’s',
    indexIntro:
      'Hieronder staan alle foto’s uit dit dossier met hun volledige ' +
      'vingerafdruk, zodat elke foto afzonderlijk te controleren is.',
    signedTitle: 'Medeondertekening door de verhuurder',
    signedBody: (name: string, when: string) =>
      `Dit dossier werd op ${when} bevestigd door ${name} via de ` +
      'uitnodigingslink. De verhuurder heeft daarbij de inhoud van dit rapport ' +
      'kunnen inzien.',
    notSignedTitle: 'Niet medeondertekend',
    notSignedBody:
      'Dit dossier is eenzijdig opgemaakt door de huurder. De verhuurder heeft ' +
      'de inhoud niet bevestigd.',
  },
  fr: {
    checkIn: "Dossier photographique d'entrée",
    checkOut: 'Dossier photographique de sortie',
    property: 'Logement',
    inspectionDate: 'Date de la constatation',
    createdBy: 'Établi par',
    leaseStart: 'Début du bail',
    leaseEnd: 'Fin du bail',
    generatedAt: 'Rapport généré le',
    photoCount: 'Nombre de photos',
    status: 'Statut de ce dossier',
    evidenceTitle: "Ce que ce dossier établit — et ce qu'il n'établit pas",
    proves: 'Ceci est établi',
    doesNotProve: "Ceci n'est pas établi",
    howItWorks: 'Comment fonctionne la constatation',
    howItWorksBody:
      'Pour chaque photo, notre serveur calcule au moment de la réception une ' +
      'empreinte SHA-256 sur les octets exacts du fichier, et enregistre ' +
      "l'heure de réception. Les deux figurent auprès de chaque photo dans ce " +
      'rapport. Pour vérifier plus tard si une photo a été modifiée, il suffit ' +
      "de recalculer l'empreinte et de comparer.",
    room: 'Pièce',
    roomNotes: 'Notes',
    noNotes: 'Aucune note.',
    missingRecommended: 'Photos recommandées manquantes dans cette pièce',
    noPhotosInRoom: "Aucune photo n'a été enregistrée pour cette pièce.",
    registeredAt: 'Enregistré sur notre serveur',
    capturedAt: "Date de prise de vue selon l'appareil",
    capturedAtCaveat:
      "Cette date provient du fichier lui-même et peut être modifiée par " +
      "l'utilisateur. Seule l'heure d'enregistrement est établie par nos soins.",
    capturedUnknown: 'Absente du fichier',
    hash: 'SHA-256',
    photoNote: 'Note',
    imageUnavailable:
      "L'image n'a pas pu être affichée dans ce rapport. Le fichier lui-même " +
      "est conservé ; l'empreinte et l'horodatage figurent ci-dessous.",
    integrityFailed:
      'ATTENTION : les octets conservés de cette photo ne correspondent plus à ' +
      "l'empreinte enregistrée lors du téléversement.",
    indexTitle: 'Index de toutes les photos',
    indexIntro:
      'Vous trouverez ci-dessous toutes les photos de ce dossier avec leur ' +
      'empreinte complète, afin que chaque photo puisse être vérifiée ' +
      'individuellement.',
    signedTitle: 'Cosignature par le bailleur',
    signedBody: (name: string, when: string) =>
      `Ce dossier a été confirmé le ${when} par ${name} via le lien ` +
      "d'invitation. Le bailleur a pu consulter le contenu de ce rapport.",
    notSignedTitle: 'Non cosigné',
    notSignedBody:
      "Ce dossier a été établi unilatéralement par le locataire. Le bailleur " +
      "n'en a pas confirmé le contenu.",
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

function formatDateTime(value: string | null, locale: Locale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${new Intl.DateTimeFormat(locale === 'nl' ? 'nl-BE' : 'fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  }).format(date)} UTC`;
}

export interface PhotoWithBytes {
  photo: InspectionPhoto;
  /** null wanneer het bestand niet kon worden opgehaald. */
  bytes: Uint8Array | null;
}

export interface InspectionReportInput {
  locale: Locale;
  inspection: Inspection;
  property: Property;
  rooms: InspectionRoom[];
  photos: PhotoWithBytes[];
  tenantName: string;
}

export async function buildInspectionReport({
  locale,
  inspection,
  property,
  rooms,
  photos,
  tenantName,
}: InspectionReportInput): Promise<Uint8Array> {
  const t = COPY[locale];
  const pdf = await PdfBuilder.create(DISCLAIMER[locale]);

  const isSigned = Boolean(inspection.landlord_signed_at);
  const level = isSigned ? 'COUNTERSIGNED_REPORT' : 'UNILATERAL_REPORT';

  // -- Titelblad -----------------------------------------------------------
  pdf.heading(
    inspection.type === 'CHECK_IN' ? t.checkIn : t.checkOut,
    20,
  );
  pdf.move(6);

  pdf.keyValue(t.property, `${property.address}, ${property.postal_code} ${property.municipality}`);
  pdf.keyValue(t.inspectionDate, formatDate(inspection.inspection_date, locale));
  pdf.keyValue(t.createdBy, tenantName);
  pdf.keyValue(t.leaseStart, formatDate(property.lease_start, locale));
  pdf.keyValue(t.leaseEnd, formatDate(property.lease_end, locale));
  pdf.keyValue(t.photoCount, String(photos.length));
  pdf.keyValue(t.generatedAt, formatDateTime(new Date().toISOString(), locale));
  pdf.move(8);

  const levelCopy = EVIDENCE_LEVELS[locale][level];
  pdf.box(`${t.status}: ${levelCopy.title}`, [levelCopy.description]);

  if (isSigned) {
    pdf.box(t.signedTitle, [
      t.signedBody(
        inspection.landlord_signature_name ?? '—',
        formatDateTime(inspection.landlord_signed_at, locale),
      ),
    ]);
  } else {
    pdf.box(t.notSignedTitle, [t.notSignedBody]);
  }

  // -- Uitlegpagina --------------------------------------------------------
  pdf.newPage();
  pdf.heading(t.evidenceTitle, 15);
  pdf.paragraph(t.howItWorksBody);
  pdf.move(6);

  pdf.heading(t.proves, 11);
  pdf.bullets([...EVIDENCE_EXPLAINER[locale].proves]);
  pdf.move(6);

  pdf.heading(t.doesNotProve, 11);
  pdf.bullets([...EVIDENCE_EXPLAINER[locale].doesNotProve], {
    color: COLORS.warning,
  });
  pdf.move(6);
  pdf.box(
    EVIDENCE_LEVELS[locale].EXPERT_INSPECTION.title,
    [EVIDENCE_LEVELS[locale].EXPERT_INSPECTION.description],
    'warning',
  );

  // -- Kamers --------------------------------------------------------------
  for (const room of rooms) {
    const roomPhotos = photos.filter(
      (entry) => entry.photo.room === room.room_key,
    );

    pdf.newPage();
    pdf.heading(`${t.room}: ${room.display_name}`, 15);

    pdf.paragraph(`${t.roomNotes}: ${room.notes ?? t.noNotes}`, {
      color: room.notes ? COLORS.text : COLORS.muted,
    });

    const completeness = roomCompleteness(
      room.room_key,
      roomPhotos.map((entry) => entry.photo),
    );

    if (completeness.missingRequired.length > 0) {
      pdf.box(
        t.missingRecommended,
        completeness.missingRequired.map((label) => {
          const slot = slotFor(label);
          return slot ? slotLabel(slot, locale) : label;
        }),
        'warning',
      );
    }

    if (roomPhotos.length === 0) {
      pdf.paragraph(t.noPhotosInRoom, { color: COLORS.muted });
      continue;
    }

    for (const entry of roomPhotos) {
      await drawPhoto(pdf, entry, locale, t);
    }
  }

  // -- Index ---------------------------------------------------------------
  pdf.newPage();
  pdf.heading(t.indexTitle, 15);
  pdf.paragraph(t.indexIntro);
  pdf.move(4);

  for (const entry of photos) {
    const slot = slotFor(entry.photo.label);
    const label = slot ? slotLabel(slot, locale) : entry.photo.label;
    pdf.paragraph(`${entry.photo.room} / ${label}`, {
      size: 9,
      font: pdf.fonts.bold,
    });
    pdf.paragraph(entry.photo.sha256, {
      size: 8,
      font: pdf.fonts.mono,
      color: COLORS.muted,
      indent: 8,
    });
    pdf.paragraph(
      `${t.registeredAt}: ${formatDateTime(entry.photo.uploaded_at, locale)}`,
      { size: 8, color: COLORS.muted, indent: 8 },
    );
    pdf.move(3);
  }

  return pdf.save();
}

async function drawPhoto(
  pdf: PdfBuilder,
  entry: PhotoWithBytes,
  locale: Locale,
  t: (typeof COPY)[Locale],
): Promise<void> {
  const { photo, bytes } = entry;
  const slot = slotFor(photo.label);
  const label = slot ? slotLabel(slot, locale) : photo.label;

  pdf.ensure(260);
  pdf.divider();
  pdf.paragraph(label, { font: pdf.fonts.bold, size: 11 });

  const integrityOk = bytes ? verifyIntegrity(bytes, photo.sha256) : null;

  if (integrityOk === false) {
    pdf.box(t.integrityFailed, [], 'warning');
  }

  if (bytes) {
    const embeddable = await toEmbeddable(bytes, photo.content_type);
    if (embeddable) {
      try {
        const image =
          embeddable.format === 'png'
            ? await pdf.doc.embedPng(embeddable.bytes)
            : await pdf.doc.embedJpg(embeddable.bytes);

        const maxWidth = A4.width - MARGIN * 2;
        const maxHeight = 300;
        const scale = Math.min(
          maxWidth / image.width,
          maxHeight / image.height,
          1,
        );
        const width = image.width * scale;
        const height = image.height * scale;

        pdf.ensure(height + 12);
        pdf.currentPage.drawImage(image, {
          x: MARGIN,
          y: pdf.y - height,
          width,
          height,
        });
        pdf.move(height + 10);
      } catch {
        pdf.paragraph(t.imageUnavailable, { color: COLORS.warning, size: 9 });
      }
    } else {
      pdf.paragraph(t.imageUnavailable, { color: COLORS.warning, size: 9 });
    }
  } else {
    pdf.paragraph(t.imageUnavailable, { color: COLORS.warning, size: 9 });
  }

  pdf.paragraph(
    `${t.registeredAt}: ${formatDateTime(photo.uploaded_at, locale)}`,
    { size: 9 },
  );
  pdf.paragraph(
    `${t.capturedAt}: ${
      photo.captured_at
        ? formatDateTime(photo.captured_at, locale)
        : t.capturedUnknown
    }`,
    { size: 9, color: COLORS.muted },
  );
  pdf.paragraph(`${t.hash}: ${photo.sha256}`, {
    size: 8,
    font: pdf.fonts.mono,
    color: COLORS.muted,
  });

  if (photo.note) {
    pdf.paragraph(`${t.photoNote}: ${toWinAnsi(photo.note)}`, { size: 9 });
  }

  pdf.move(6);
}

export { COPY as INSPECTION_REPORT_COPY };
