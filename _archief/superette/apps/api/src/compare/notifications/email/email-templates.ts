/**
 * E-mailteksten voor prijsalerts. Alle externe tekst (productnamen, ketens,
 * voorwaarden) wordt HTML-geëscapet; niets wordt als HTML ingevoegd.
 */
import type { AlertNotification } from '@superette/contracts';

export function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function euro(cents: number): string {
  return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export interface DigestEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Eén overzicht per gebruiker per dag, met een eerlijke demovermelding waar van toepassing. */
export function buildDigestEmail(notifications: readonly AlertNotification[], webUrl: string): DigestEmail {
  const count = notifications.length;
  const subject = count === 1 ? `Superette: ${notifications[0]!.productName} heeft je doelprijs bereikt` : `Superette: ${count} prijsalerts bereikt`;
  const preferencesUrl = `${webUrl}/profiel/voorkeuren`;
  const anyDemo = notifications.some((n) => /demogegevens/i.test(n.message));

  const lines = notifications.map((n) => {
    const where = n.storeChain ? ` bij ${n.storeChain.name}${n.storeLocationName ? ` (${n.storeLocationName})` : ''}` : '';
    const was = n.previousPriceCents !== null ? ` (was ${euro(n.previousPriceCents)})` : '';
    const target = n.targetPriceCents !== null ? ` · jouw grens ${euro(n.targetPriceCents)}` : '';
    const conditions = n.conditions ? ` · ${n.conditions}` : '';
    return `• ${n.productName}: ${euro(n.triggeredPriceCents)}${where}${was}${target}${conditions}\n  ${webUrl}${n.link}`;
  });

  const text = [
    count === 1 ? 'Een van je prijsalerts is bereikt.' : `${count} van je prijsalerts zijn bereikt.`,
    '',
    ...lines,
    '',
    anyDemo ? 'Let op: deze prijzen zijn demogegevens, geen actuele winkelprijzen.' : 'Prijzen zijn gecontroleerd op het vermelde moment; controleer ze in de winkel.',
    '',
    `E-mailmeldingen uitzetten of aanpassen: ${preferencesUrl}`,
  ].join('\n');

  const items = notifications
    .map((n) => {
      const where = n.storeChain ? ` bij <strong>${escapeHtml(n.storeChain.name)}</strong>${n.storeLocationName ? ` (${escapeHtml(n.storeLocationName)})` : ''}` : '';
      const was = n.previousPriceCents !== null ? ` <span style="color:#6b625a">(was ${euro(n.previousPriceCents)})</span>` : '';
      const target = n.targetPriceCents !== null ? `<br><span style="color:#6b625a">Jouw grens: ${euro(n.targetPriceCents)}</span>` : '';
      const conditions = n.conditions ? `<br><span style="color:#6b625a">${escapeHtml(n.conditions)}</span>` : '';
      return `<li style="margin:0 0 12px"><strong>${escapeHtml(n.productName)}</strong>: ${euro(n.triggeredPriceCents)}${where}${was}${target}${conditions}<br><a href="${escapeHtml(webUrl + n.link)}">Bekijk product</a></li>`;
    })
    .join('');

  const html = `<!doctype html><html lang="nl"><body style="font-family:Segoe UI,system-ui,sans-serif;color:#1f1b17;background:#fbf7f0;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">Superette</h1>
<p>${count === 1 ? 'Een van je prijsalerts is bereikt.' : `${count} van je prijsalerts zijn bereikt.`}</p>
<ul style="padding-left:18px">${items}</ul>
<p style="font-size:13px;color:#7a4f0b">${anyDemo ? 'Let op: deze prijzen zijn demogegevens, geen actuele winkelprijzen.' : 'Prijzen zijn gecontroleerd op het vermelde moment; controleer ze in de winkel.'}</p>
<p style="font-size:12px;color:#6b625a">E-mailmeldingen uitzetten of aanpassen: <a href="${escapeHtml(preferencesUrl)}">${escapeHtml(preferencesUrl)}</a></p>
</body></html>`;

  return { subject, text, html };
}
