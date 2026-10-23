import { describe, expect, it } from 'vitest';

import { renderTemplate, templateFields } from '@/lib/letters/render';

describe('renderTemplate', () => {
  it('vervangt eenvoudige velden', () => {
    const result = renderTemplate('Beste {{name}}, bedrag: {{amount}} EUR.', {
      name: 'Dupont',
      amount: 1600,
    });

    expect(result.text).toBe('Beste Dupont, bedrag: 1600 EUR.');
    expect(result.missingFields).toEqual([]);
  });

  it('laat een ontbrekend veld zichtbaar staan en meldt het', () => {
    const result = renderTemplate('Rekening: {{iban}}', {});

    expect(result.text).toContain('{{iban}}');
    expect(result.missingFields).toEqual(['iban']);
  });

  it('behandelt een lege string als ontbrekend', () => {
    const result = renderTemplate('Rekening: {{iban}}', { iban: '   ' });
    expect(result.missingFields).toEqual(['iban']);
  });

  it('behandelt het getal nul als aanwezig', () => {
    const result = renderTemplate('Terugbetaald: {{amount}}', { amount: 0 });
    expect(result.text).toBe('Terugbetaald: 0');
    expect(result.missingFields).toEqual([]);
  });

  it('houdt een voorwaardelijk blok wanneer het veld ingevuld is', () => {
    const result = renderTemplate(
      'A{{#if reason}} — reden: {{reason}}{{/if}} B',
      { reason: 'schade' },
    );

    expect(result.text).toBe('A — reden: schade B');
    expect(result.missingFields).toEqual([]);
  });

  it('laat een voorwaardelijk blok weg wanneer het veld leeg is', () => {
    const result = renderTemplate(
      'A{{#if reason}} — reden: {{reason}}{{/if}} B',
      {},
    );

    expect(result.text).toBe('A B');
  });

  it('meldt geen ontbrekende velden uit een weggelaten blok', () => {
    const result = renderTemplate(
      '{{#if has_report}}Bijlage: {{report_name}}{{/if}}',
      {},
    );

    expect(result.missingFields).toEqual([]);
    expect(result.text).toBe('');
  });

  it('meldt wél ontbrekende velden in een behouden blok', () => {
    const result = renderTemplate(
      '{{#if has_report}}Bijlage: {{report_name}}{{/if}}',
      { has_report: 'ja' },
    );

    expect(result.missingFields).toEqual(['report_name']);
  });

  it('verwerkt meerdere blokken over meerdere regels', () => {
    const template = [
      'Regel 1',
      '{{#if a}}Blok A{{/if}}',
      '{{#if b}}Blok B{{/if}}',
      'Slot',
    ].join('\n');

    const result = renderTemplate(template, { b: 'x' });
    expect(result.text).toBe('Regel 1\n\nBlok B\nSlot');
  });

  it('vervangt hetzelfde veld meermaals', () => {
    const result = renderTemplate('{{x}} en nog eens {{x}}', { x: 'ja' });
    expect(result.text).toBe('ja en nog eens ja');
  });

  it('raakt tekst zonder placeholders niet aan', () => {
    const text = 'Gewone brieftekst zonder velden.';
    expect(renderTemplate(text, {}).text).toBe(text);
  });

  it('interpreteert geen syntaxis uit een ingevulde waarde', () => {
    const result = renderTemplate('{{note}}', { note: '{{iban}}' });
    // De waarde wordt letterlijk ingevoegd, niet opnieuw geëvalueerd.
    expect(result.text).toBe('{{iban}}');
    expect(result.missingFields).toEqual([]);
  });

  it('somt alle gebruikte velden op', () => {
    const result = renderTemplate('{{a}} {{#if b}}{{c}}{{/if}}', {
      a: '1',
      b: '1',
      c: '1',
    });
    expect(result.usedFields).toEqual(['a', 'b', 'c']);
  });
});

describe('templateFields', () => {
  it('vindt velden zonder te renderen', () => {
    expect(
      templateFields('{{sender_name}} {{#if x}}{{y}}{{/if}} {{sender_name}}'),
    ).toEqual(['sender_name', 'x', 'y']);
  });

  it('geeft een lege lijst voor een template zonder velden', () => {
    expect(templateFields('Vaste tekst.')).toEqual([]);
  });
});
