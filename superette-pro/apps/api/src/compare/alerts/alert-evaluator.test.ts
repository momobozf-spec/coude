import { describe, expect, it } from 'vitest';
import { CHAINS, offer } from '../test-fixtures';
import { comparedValue, derivedState, evaluateAlert, type AlertRule } from './alert-evaluator';

const rule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
  status: 'ACTIVE',
  comparisonType: 'PACKAGE_PRICE',
  targetPriceCents: 179,
  minimumDiscountPercentage: null,
  matchPreference: 'EXACT',
  includeLoyaltyOffers: true,
  includePersonalizedOffers: false,
  includeOnlineOffers: true,
  armed: true,
  lastTriggeredPriceCents: null,
  ...overrides,
});

const options = { allowDemo: false };

describe('evaluateAlert — verpakkingsprijs', () => {
  it('gaat af onder de grens', () => {
    const result = evaluateAlert(rule(), [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 169 }), matchType: 'EXACT' }], options);
    expect(result.triggered).toBe(true);
    expect(result.best?.comparedValue).toBe(169);
  });

  it('gaat af precies op de grens', () => {
    const result = evaluateAlert(rule(), [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 179 }), matchType: 'EXACT' }], options);
    expect(result.triggered).toBe(true);
  });

  it('gaat niet af boven de grens', () => {
    const result = evaluateAlert(rule(), [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 180 }), matchType: 'EXACT' }], options);
    expect(result.triggered).toBe(false);
    expect(result.thresholdMet).toBe(false);
  });

  it('kiest de laagste prijs over meerdere winkels', () => {
    const result = evaluateAlert(
      rule(),
      [
        { offer: offer({ storeChain: CHAINS.delhaize!, priceCents: 199 }), matchType: 'EXACT' },
        { offer: offer({ storeChain: CHAINS.lidl!, priceCents: 159 }), matchType: 'EXACT' },
        { offer: offer({ storeChain: CHAINS.colruyt!, priceCents: 175 }), matchType: 'EXACT' },
      ],
      options,
    );
    expect(result.best?.candidate.offer.storeChain.slug).toBe('lidl');
  });
});

describe('evaluateAlert — eenheidsprijs en korting', () => {
  it('vergelijkt op prijs per liter', () => {
    const result = evaluateAlert(
      rule({ comparisonType: 'UNIT_PRICE', targetPriceCents: 120 }),
      [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 179, unitPrice: { cents: 119, unit: 'L' } }), matchType: 'EXACT' }],
      options,
    );
    expect(result.triggered).toBe(true);
    expect(result.best?.comparedValue).toBe(119);
  });

  it('weigert een onvergelijkbaar product zonder eenheidsprijs', () => {
    const result = evaluateAlert(
      rule({ comparisonType: 'UNIT_PRICE', targetPriceCents: 120 }),
      [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 100, unitPrice: null }), matchType: 'EXACT' }],
      options,
    );
    expect(result.triggered).toBe(false);
    expect(result.reason).toContain('niet vergelijkbaar');
  });

  it('kortingsalert gaat af vanaf het minimumpercentage', () => {
    const discountRule = rule({ comparisonType: 'DISCOUNT_PERCENTAGE', targetPriceCents: null, minimumDiscountPercentage: 30 });
    const twentyFive = offer({ storeChain: CHAINS.delhaize!, priceCents: 150, originalPriceCents: 200, discountPercentage: 25 });
    const thirty = offer({ storeChain: CHAINS.delhaize!, priceCents: 140, originalPriceCents: 200, discountPercentage: 30 });

    expect(evaluateAlert(discountRule, [{ offer: twentyFive, matchType: 'EXACT' }], options).triggered).toBe(false);
    expect(evaluateAlert(discountRule, [{ offer: thirty, matchType: 'EXACT' }], options).triggered).toBe(true);
    expect(comparedValue(thirty, 'DISCOUNT_PERCENTAGE')).toBe(30);
  });
});

describe('evaluateAlert — voorwaarden', () => {
  it('sluit klantenkaartprijzen uit wanneer de gebruiker dat vraagt', () => {
    const loyalty = offer({ storeChain: CHAINS.delhaize!, priceCents: 150, requiresLoyaltyCard: true });
    expect(evaluateAlert(rule({ includeLoyaltyOffers: false }), [{ offer: loyalty, matchType: 'EXACT' }], options).triggered).toBe(false);
    expect(evaluateAlert(rule({ includeLoyaltyOffers: true }), [{ offer: loyalty, matchType: 'EXACT' }], options).triggered).toBe(true);
  });

  it('sluit persoonlijke aanbiedingen standaard uit', () => {
    const personal = offer({ storeChain: CHAINS.colruyt!, priceCents: 150, isPersonalized: true });
    expect(evaluateAlert(rule(), [{ offer: personal, matchType: 'EXACT' }], options).triggered).toBe(false);
    expect(evaluateAlert(rule({ includePersonalizedOffers: true }), [{ offer: personal, matchType: 'EXACT' }], options).triggered).toBe(true);
  });

  it('sluit online-prijzen uit wanneer de gebruiker dat vraagt', () => {
    const online = offer({ storeChain: CHAINS.colruyt!, priceCents: 150, channel: 'ONLINE' });
    expect(evaluateAlert(rule({ includeOnlineOffers: false }), [{ offer: online, matchType: 'EXACT' }], options).triggered).toBe(false);
  });

  it('negeert alternatieven en onzekere matches bij een exacte alert', () => {
    const cheap = offer({ storeChain: CHAINS.colruyt!, priceCents: 69 });
    expect(evaluateAlert(rule(), [{ offer: cheap, matchType: 'ALTERNATIVE' }], options).triggered).toBe(false);
    expect(evaluateAlert(rule({ matchPreference: 'ALTERNATIVE' }), [{ offer: cheap, matchType: 'ALTERNATIVE' }], options).triggered).toBe(true);
    expect(evaluateAlert(rule({ matchPreference: 'ALTERNATIVE' }), [{ offer: cheap, matchType: 'UNCERTAIN' }], options).triggered).toBe(false);
  });

  it('negeert demoprijzen tenzij expliciet toegestaan', () => {
    const demo = offer({ storeChain: CHAINS.lidl!, priceCents: 100 });
    const demoOffer = { ...demo, provenance: { ...demo.provenance, sourceKind: 'DEMO' as const, status: 'DEMO' as const, isDemo: true } };
    expect(evaluateAlert(rule(), [{ offer: demoOffer, matchType: 'EXACT' }], { allowDemo: false }).triggered).toBe(false);
    expect(evaluateAlert(rule(), [{ offer: demoOffer, matchType: 'EXACT' }], { allowDemo: true }).triggered).toBe(true);
  });

  it('negeert verlopen prijzen', () => {
    const base = offer({ storeChain: CHAINS.lidl!, priceCents: 100 });
    const expired = { ...base, provenance: { ...base.provenance, status: 'EXPIRED' as const } };
    expect(evaluateAlert(rule(), [{ offer: expired, matchType: 'EXACT' }], options).triggered).toBe(false);
  });

  it('gepauzeerde alert gaat nooit af', () => {
    expect(evaluateAlert(rule({ status: 'PAUSED' }), [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 1 }), matchType: 'EXACT' }], options).triggered).toBe(false);
  });
});

describe('evaluateAlert — niet twee keer melden', () => {
  it('meldt niet opnieuw voor dezelfde prijs', () => {
    const armedOff = rule({ armed: false, lastTriggeredPriceCents: 169 });
    const result = evaluateAlert(armedOff, [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 169 }), matchType: 'EXACT' }], options);
    expect(result.triggered).toBe(false);
    expect(result.reason).toContain('Al gemeld');
  });

  it('meldt wél opnieuw bij een nieuwe daling', () => {
    const armedOff = rule({ armed: false, lastTriggeredPriceCents: 169 });
    const result = evaluateAlert(armedOff, [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 159 }), matchType: 'EXACT' }], options);
    expect(result.triggered).toBe(true);
  });

  it('zet de alert opnieuw op scherp zodra de prijs boven de grens komt', () => {
    const armedOff = rule({ armed: false, lastTriggeredPriceCents: 169 });
    const result = evaluateAlert(armedOff, [{ offer: offer({ storeChain: CHAINS.lidl!, priceCents: 199 }), matchType: 'EXACT' }], options);
    expect(result.triggered).toBe(false);
    expect(result.rearm).toBe(true);
  });
});

describe('derivedState', () => {
  it('leidt de toestand af voor het overzicht', () => {
    expect(derivedState(rule({ status: 'PAUSED' }), { comparedValue: 100 })).toBe('PAUSED');
    expect(derivedState(rule(), null)).toBe('UNAVAILABLE');
    expect(derivedState(rule(), { comparedValue: 179 })).toBe('REACHED');
    expect(derivedState(rule(), { comparedValue: 190 })).toBe('ALMOST');
    expect(derivedState(rule(), { comparedValue: 250 })).toBe('ACTIVE');
    expect(derivedState(rule({ comparisonType: 'DISCOUNT_PERCENTAGE', minimumDiscountPercentage: 30, targetPriceCents: null }), { comparedValue: 27 })).toBe('ALMOST');
  });
});
