import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAldiProductPage, type AldiPageInput } from './parse';

const evidence = JSON.parse(readFileSync(join(__dirname, 'fixtures/diagnose-2026-10-08.json'), 'utf8')) as (AldiPageInput & { originalResult: ReturnType<typeof parseAldiProductPage> })[];

describe('ALDI ontbrekende prijs: echte diagnose van 8 oktober', () => {
  for (const page of evidence) {
    it(page.url, () => {
      const result = parseAldiProductPage(page);
      if (page.originalResult.ok) expect(result).toEqual(page.originalResult);
      else expect(result).toMatchObject({ ok: false, kind: 'skipped', reason: 'leesbare ALDI-productpagina zonder vermelde prijs; product overgeslagen' });
    });
  }
  it('houdt onleesbare pagina zonder Product als fout', () => {
    expect(parseAldiProductPage({ ...evidence[0]!, jsonLd: [] })).toMatchObject({ ok: false, kind: 'unreadable' });
  });
  it('houdt een ongeldige aanwezige prijs als fout', () => {
    const page = evidence[0]!;
    const jsonLd = page.jsonLd.map((block) => {
      const node = JSON.parse(block);
      if (node['@type'] === 'Product') node.offers.price = 'onleesbaar';
      return JSON.stringify(node);
    });
    expect(parseAldiProductPage({ ...page, jsonLd })).toMatchObject({ ok: false, kind: 'unreadable' });
  });
});
