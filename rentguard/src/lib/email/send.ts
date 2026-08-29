import 'server-only';

import { getEnv, integrationStatus } from '@/lib/env';
import type { Locale } from '@/i18n/config';

/**
 * Transactionele e-mail.
 *
 * Dit is **gewone e-mail**. Nergens in deze module, en nergens in de teksten die
 * ze verstuurt, staat of suggereert iets dat dit een aangetekende zending zou
 * zijn. Zie docs/decisions/0001-aangetekende-zending-provider.md.
 *
 * Zonder Resend-configuratie mislukt verzenden netjes met een reden, in plaats
 * van te doen alsof er iets vertrokken is.
 */

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'PROVIDER_ERROR' };

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send({ to, subject, html, text }: SendArgs): Promise<SendResult> {
  const env = getEnv();

  if (integrationStatus('email', env) !== 'LIVE') {
    return { ok: false, reason: 'NOT_CONFIGURED' };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL as string,
      to,
      subject,
      html,
      text,
    });

    if (error) return { ok: false, reason: 'PROVIDER_ERROR' };
    return { ok: true, id: data?.id ?? null };
  } catch {
    return { ok: false, reason: 'PROVIDER_ERROR' };
  }
}

function layout(bodyHtml: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
${bodyHtml}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="font-size:12px;color:#64748b;margin:0">${footer}</p>
</div></body></html>`;
}

const COPY = {
  nl: {
    inviteSubject: 'Uitnodiging: fotodossier van de woning bekijken',
    inviteIntro:
      'Uw huurder heeft een fotodossier van de woning opgemaakt en nodigt u uit ' +
      'om het te bekijken en, als u het eens bent met de vaststellingen, mee te ' +
      'ondertekenen.',
    inviteWhy:
      'Een dossier dat beide partijen hebben bevestigd, voorkomt discussie bij ' +
      'het einde van de huur. U bent hiertoe niet verplicht.',
    inviteCta: 'Het dossier bekijken',
    inviteExpiry: 'Deze link blijft 30 dagen geldig.',
    footer:
      'Deze e-mail komt van RentGuard, in naam van uw huurder. Dit is een gewone ' +
      'e-mail en geen aangetekende zending. RentGuard geeft geen juridisch advies.',
    reminderSubject: 'Herinnering: termijn voor uw huurwaarborg',
    footerTenant:
      'RentGuard levert informatie en hulpmiddelen, geen juridisch advies.',
  },
  fr: {
    inviteSubject: 'Invitation : consulter le dossier photographique du logement',
    inviteIntro:
      'Votre locataire a établi un dossier photographique du logement et vous ' +
      'invite à le consulter et, si vous êtes d’accord avec les constatations, à ' +
      'le cosigner.',
    inviteWhy:
      'Un dossier confirmé par les deux parties évite les discussions à la fin ' +
      'du bail. Vous n’y êtes pas obligé.',
    inviteCta: 'Consulter le dossier',
    inviteExpiry: 'Ce lien reste valable 30 jours.',
    footer:
      'Cet e-mail provient de RentGuard, au nom de votre locataire. Il s’agit ' +
      'd’un e-mail ordinaire et non d’un envoi recommandé. RentGuard ne donne ' +
      'pas de conseil juridique.',
    reminderSubject: 'Rappel : délai concernant votre garantie locative',
    footerTenant:
      'RentGuard fournit des informations et des outils, pas de conseil juridique.',
  },
} as const;

export async function sendLandlordInvite({
  to,
  locale,
  token,
  inspectionId,
}: {
  to: string;
  locale: Locale;
  token: string;
  inspectionId: string;
}): Promise<SendResult> {
  const env = getEnv();
  const copy = COPY[locale];
  const url = `${env.APP_URL}/${locale}/landlord/${token}`;

  const html = layout(
    `<p style="margin:0 0 16px">${copy.inviteIntro}</p>
     <p style="margin:0 0 16px">${copy.inviteWhy}</p>
     <p style="margin:0 0 16px"><a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">${copy.inviteCta}</a></p>
     <p style="margin:0;font-size:13px;color:#475569">${copy.inviteExpiry}</p>`,
    copy.footer,
  );

  const text = [
    copy.inviteIntro,
    '',
    copy.inviteWhy,
    '',
    url,
    '',
    copy.inviteExpiry,
    '',
    copy.footer,
  ].join('\n');

  const result = await send({ to, subject: copy.inviteSubject, html, text });

  // inspectionId wordt niet in de mail gezet: het token is de enige sleutel.
  void inspectionId;
  return result;
}

export async function sendDepositReminder({
  to,
  locale,
  subjectLine,
  bodyLines,
  linkPath,
}: {
  to: string;
  locale: Locale;
  subjectLine: string;
  bodyLines: string[];
  linkPath: string;
}): Promise<SendResult> {
  const env = getEnv();
  const copy = COPY[locale];
  const url = `${env.APP_URL}${linkPath}`;

  const html = layout(
    `${bodyLines
      .map((line) => `<p style="margin:0 0 12px">${line}</p>`)
      .join('')}
     <p style="margin:16px 0 0"><a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">RentGuard</a></p>`,
    copy.footerTenant,
  );

  return send({
    to,
    subject: subjectLine,
    html,
    text: [...bodyLines, '', url, '', copy.footerTenant].join('\n'),
  });
}
