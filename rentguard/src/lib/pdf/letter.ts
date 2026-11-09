import 'server-only';

import type { Locale } from '@/i18n/config';
import { DISCLAIMER } from '@/lib/legal/disclaimer';
import { COLORS, PdfBuilder } from '@/lib/pdf/builder';
import type { RuleSnapshotEntry } from '@/lib/legal/rules';
import type { LetterReviewStatus } from '@/lib/supabase/types';

const COPY = {
  nl: {
    sourcesTitle: 'Bronnen bij deze brief',
    sourcesIntro:
      'Deze brief verwijst naar de volgende regels. Per regel staat waar wij ze ' +
      'gevonden hebben en wanneer wij dat voor het laatst nagekeken hebben.',
    consultedOn: 'geraadpleegd op',
    officialSource: 'officiële bron',
    unofficialSource: 'niet-officiële bron',
    statusTitle: 'Status van de brieftekst',
    placeholder:
      'Deze brieftekst is nog niet door een jurist nagekeken. Lees hem ' +
      'aandachtig na voordat u hem verstuurt.',
    reviewed: 'Deze brieftekst is nagekeken door een jurist.',
    needsVerification:
      'Minstens één regel waarop deze brief steunt, is nog niet in een ' +
      'officiële bron bevestigd.',
    approvedAt: 'Goedgekeurd door de afzender op',
    notApproved: 'Nog niet goedgekeurd door de afzender.',
  },
  fr: {
    sourcesTitle: 'Sources de ce courrier',
    sourcesIntro:
      'Ce courrier renvoie aux règles suivantes. Pour chacune figure où nous ' +
      "l'avons trouvée et quand nous l'avons vérifiée pour la dernière fois.",
    consultedOn: 'consultée le',
    officialSource: 'source officielle',
    unofficialSource: 'source non officielle',
    statusTitle: 'Statut du modèle de courrier',
    placeholder:
      "Ce modèle n'a pas encore été relu par un juriste. Lisez-le attentivement " +
      'avant de l’envoyer.',
    reviewed: 'Ce modèle a été relu par un juriste.',
    needsVerification:
      "Au moins une règle sur laquelle repose ce courrier n'a pas encore été " +
      'confirmée dans une source officielle.',
    approvedAt: "Approuvé par l'expéditeur le",
    notApproved: "Pas encore approuvé par l'expéditeur.",
  },
} as const;

export interface LetterPdfInput {
  locale: Locale;
  body: string;
  ruleSnapshot: Record<string, RuleSnapshotEntry>;
  templateReviewStatus: LetterReviewStatus;
  needsVerification: boolean;
  approvedAt: string | null;
}

/**
 * Zet een gerenderde brief om naar PDF.
 *
 * De brieftekst zelf staat op de eerste bladzijden, precies zoals hij
 * goedgekeurd is. Daarna volgt een bijlage met de bronnen en de status van de
 * template. Die bijlage staat er bewust achteraan: ze hoort bij het dossier,
 * niet in de brief aan de verhuurder.
 */
export async function buildLetterPdf({
  locale,
  body,
  ruleSnapshot,
  templateReviewStatus,
  needsVerification,
  approvedAt,
}: LetterPdfInput): Promise<Uint8Array> {
  const t = COPY[locale];
  const pdf = await PdfBuilder.create(DISCLAIMER[locale]);

  for (const paragraph of body.split('\n')) {
    if (paragraph.trim() === '') {
      pdf.move(8);
      continue;
    }
    pdf.paragraph(paragraph, { size: 10.5 });
  }

  // -- Bijlage bij het dossier ---------------------------------------------
  pdf.newPage();
  pdf.heading(t.statusTitle, 14);
  pdf.paragraph(
    templateReviewStatus === 'REVIEWED' ? t.reviewed : t.placeholder,
    { color: templateReviewStatus === 'REVIEWED' ? COLORS.text : COLORS.warning },
  );

  if (needsVerification) {
    pdf.move(4);
    pdf.paragraph(t.needsVerification, { color: COLORS.warning });
  }

  pdf.move(6);
  pdf.paragraph(
    approvedAt
      ? `${t.approvedAt} ${new Date(approvedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC`
      : t.notApproved,
    { size: 9, color: COLORS.muted },
  );

  const entries = Object.values(ruleSnapshot);
  if (entries.length > 0) {
    pdf.move(10);
    pdf.heading(t.sourcesTitle, 13);
    pdf.paragraph(t.sourcesIntro, { size: 9.5 });
    pdf.move(4);

    for (const entry of entries) {
      pdf.paragraph(entry.rule_key, { font: pdf.fonts.bold, size: 9.5 });
      pdf.paragraph(
        `${entry.source_name} (${
          entry.source_is_official ? t.officialSource : t.unofficialSource
        }) — ${t.consultedOn} ${entry.verified_at} — ${entry.status}`,
        { size: 9, color: COLORS.muted, indent: 8 },
      );
      pdf.paragraph(entry.source_url, {
        size: 8,
        color: COLORS.muted,
        indent: 8,
      });
      pdf.move(4);
    }
  }

  return pdf.save();
}
