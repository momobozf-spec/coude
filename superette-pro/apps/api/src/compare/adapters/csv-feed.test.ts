import { describe, expect, it } from 'vitest';
import { csvToFeed, parseCsv } from './csv-feed';

const options = {
  chain: { slug: 'testketen', name: 'Testketen' },
  label: 'Testbestand',
  observedAt: new Date('2026-10-04T08:00:00Z'),
  termsReviewed: true,
};

describe('parseCsv', () => {
  it('leest aanhalingstekens, komma’s in velden en beide scheidingstekens', () => {
    expect(parseCsv('a,b,c\n1,"x, y","zeg ""hoi"""\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', 'x, y', 'zeg "hoi"'],
    ]);
    expect(parseCsv('a;b\r\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('negeert lege regels en een BOM', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n   \n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('csvToFeed', () => {
  const header = 'productExternalId,name,brand,barcode,packageQuantity,packageUnit,packCount,categorySlug,sourceReference,priceCents,originalPriceCents,promotionType,promotionRule,requiresLoyaltyCard,channel';

  it('zet rijen om naar een gevalideerde feed met unieke producten', () => {
    const csv = [
      header,
      'sku-1,Coca-Cola Zero 1.5 l,Coca-Cola,5449000131805,1.5,L,1,dranken,sku-1:regular,199,,NONE,,false,BOTH',
      'sku-1,Coca-Cola Zero 1.5 l,Coca-Cola,5449000131805,1.5,L,1,dranken,sku-1:promo,199,,MULTIBUY,"{""kind"":""MULTIBUY"",""quantity"":2,""totalCents"":300}",false,BOTH',
      'sku-2,Halfvolle melk 1 l,Testketen,,1,L,,zuivel,sku-2:regular,95,109,PERCENTAGE,,true,IN_STORE',
    ].join('\n');

    const feed = csvToFeed(csv, options);

    expect(feed.version).toBe(1);
    expect(feed.chain.slug).toBe('testketen');
    expect(feed.source.kind).toBe('IMPORT_FILE');
    expect(feed.products).toHaveLength(2);
    expect(feed.offers).toHaveLength(3);
    expect(feed.offers[1]?.promotionRule).toEqual({ kind: 'MULTIBUY', quantity: 2, totalCents: 300 });
    expect(feed.offers[2]).toMatchObject({ priceCents: 95, originalPriceCents: 109, requiresLoyaltyCard: true, channel: 'IN_STORE' });
  });

  it('weigert rijen zonder verplichte velden of met ongeldige waarden', () => {
    expect(() => csvToFeed('name,priceCents\nMelk,100', options)).toThrow(/productExternalId/);
    expect(() => csvToFeed('productExternalId,name\nsku-1,Melk', options)).toThrow(/priceCents/);
    expect(() => csvToFeed(`${header}\nsku-1,Melk,,,1,L,1,zuivel,ref,1.5,,NONE,,false,BOTH`, options)).toThrow(/ongeldig/i);
    expect(() => csvToFeed(`${header}\nsku-1,Melk,,,1,L,1,zuivel,ref,100,,NONE,{niet-json},false,BOTH`, options)).toThrow(/JSON/);
  });

  it('weigert een leeg bestand', () => {
    expect(() => csvToFeed('', options)).toThrow(/leeg/);
  });
});
