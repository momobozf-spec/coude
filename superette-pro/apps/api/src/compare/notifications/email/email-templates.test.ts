import type { AlertNotification } from '@superette/contracts';
import { describe, expect, it } from 'vitest';
import { buildDigestEmail, escapeHtml } from './email-templates';

const notification = (overrides: Partial<AlertNotification> = {}): AlertNotification => ({
  id: 'n1',
  priceAlertId: 'a1',
  channel: 'EMAIL',
  status: 'PENDING',
  productName: 'Coca-Cola Zero 1,5 l',
  storeChain: { id: 'c1', slug: 'lidl', name: 'Lidl', logoUrl: null },
  storeLocationName: null,
  triggeredPriceCents: 169,
  previousPriceCents: 199,
  targetPriceCents: 179,
  savingsCents: 30,
  unitPriceCents: 113,
  conditions: null,
  validUntil: null,
  link: '/producten/p1',
  cheaperAlternative: null,
  message: 'Coca-Cola Zero 1,5 l kost nu € 1,69 bij Lidl · demogegevens',
  sentAt: null,
  readAt: null,
  createdAt: '2026-10-04T08:00:00.000Z',
  ...overrides,
});

describe('e-mailoverzicht', () => {
  it('escapet externe tekst in HTML', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });

  it('bouwt onderwerp, tekst en HTML met prijzen, grens en link', () => {
    const email = buildDigestEmail([notification()], 'https://superette.example');
    expect(email.subject).toContain('Coca-Cola Zero 1,5 l');
    expect(email.text).toContain('1,69');
    expect(email.text).toContain('jouw grens');
    expect(email.text).toContain('https://superette.example/producten/p1');
    expect(email.html).toContain('<strong>Lidl</strong>');
  });

  it('vermeldt demogegevens eerlijk en biedt een uitschrijflink', () => {
    const email = buildDigestEmail([notification()], 'https://superette.example');
    expect(email.text).toContain('demogegevens');
    expect(email.html).toContain('/profiel/voorkeuren');
  });

  it('laat een kwaadaardige productnaam niet als HTML door', () => {
    const email = buildDigestEmail([notification({ productName: '<script>alert(1)</script>', message: 'x' })], 'https://superette.example');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.subject).toContain('<script>'); // onderwerp is platte tekst; mailclients renderen geen HTML in onderwerpen
  });
});

describe('afzender in de e-mail', () => {
  it('vermeldt uitbater, ondernemingsnummer en adres (geëscapet) als die is meegegeven', async () => {
    const { legalFooterLine } = await import('../../../config/legal-entity');
    const line = legalFooterLine('Straat 1 <b>, 1930 Zaventem');
    const email = buildDigestEmail([notification()], 'https://superette.example', line);
    expect(email.text).toContain('Marhaba Data & AI Agent BV · BE 1003.552.102 · Straat 1 <b>, 1930 Zaventem');
    expect(email.html).toContain('Marhaba Data &amp; AI Agent BV');
    expect(email.html).not.toContain('<b>,');
    expect(legalFooterLine(undefined)).toContain('Zaventem');
  });
});
