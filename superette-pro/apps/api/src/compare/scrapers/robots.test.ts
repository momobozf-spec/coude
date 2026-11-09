import { describe, expect, it } from 'vitest';
import { crawlDelayFor, isAllowed, parseRobots } from './robots';

// Fragmenten zoals ze op 6 oktober 2026 in de robots.txt van de ketens stonden.
const DELHAIZE = `
User-agent: *
Disallow: /login
Disallow: /my-account
Disallow: */search/*
Disallow: */search?*
Disallow: /en/
Sitemap: https://www.delhaize.be/sitemap/delhaizesitemapindex.xml
`;

const COLRUYT = `
User-agent: *
crawl-delay: 5
Disallow: /nl/producten/product-detail
Disallow: /content/clp
Allow: /content/clp/*.*.json$
`;

const CARREFOUR_LIKE = `
User-agent: GPTBot
Allow: /
Disallow: /checkout

User-agent: *
Disallow: /
`;

const UA = 'SuperetteBot';

describe('robots.txt', () => {
  it('laat productpagina’s van Delhaize toe en weigert zoeken en accountpagina’s', () => {
    const policy = parseRobots(DELHAIZE);
    expect(isAllowed(policy, UA, '/nl/shop/Koude-en-warme-dranken/Frisdrank/Cola/Klassieke-cola/Original-taste-PET/p/S1991061400921760000')).toBe(true);
    expect(isAllowed(policy, UA, '/nl/shop/Koude-en-warme-dranken/Frisdrank/Cola/c/v2DRISOFCOL')).toBe(true);
    expect(isAllowed(policy, UA, '/nl/search/?text=cola')).toBe(false);
    expect(isAllowed(policy, UA, '/nl/search?text=cola')).toBe(false);
    expect(isAllowed(policy, UA, '/my-account/orders')).toBe(false);
    expect(policy.sitemaps).toEqual(['https://www.delhaize.be/sitemap/delhaizesitemapindex.xml']);
  });

  it('weigert productdetails van Colruyt en leest de crawl-delay', () => {
    const policy = parseRobots(COLRUYT);
    expect(isAllowed(policy, UA, '/nl/producten/product-detail/123')).toBe(false);
    expect(crawlDelayFor(policy, UA)).toBe(5);
  });

  it('past de langste regel toe en verankert $', () => {
    const policy = parseRobots(COLRUYT);
    expect(isAllowed(policy, UA, '/content/clp/a.b.json')).toBe(true);
    expect(isAllowed(policy, UA, '/content/clp/a.b.json?x=1')).toBe(false);
    expect(isAllowed(policy, UA, '/content/clp/page')).toBe(false);
  });

  it('valt terug op de *-groep wanneer onze bot niet genoemd wordt', () => {
    const policy = parseRobots(CARREFOUR_LIKE);
    expect(isAllowed(policy, UA, '/nl/producten/x')).toBe(false);
    expect(isAllowed(policy, 'GPTBot', '/nl/producten/x')).toBe(true);
  });

  it('beschouwt een lege robots.txt als alles toegestaan', () => {
    expect(isAllowed(parseRobots(''), UA, '/alles')).toBe(true);
  });
});
